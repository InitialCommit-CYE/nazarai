"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { homeFor, type AppRole } from "@/lib/roles";
import { overLimit } from "@/lib/server/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  ok?: string;
  fields?: Record<string, string>;
}

const Password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only same-site relative paths; never back into /auth, never protocol-relative (open redirect). */
function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/auth")) return null;
  return next;
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const fields = { email };
  if (overLimit("sign-in", await clientKey(), 10, 5 * 60_000)) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again.", fields };
  }
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({ email, password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password.", fields };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { error: "Please confirm your email address first. Check your inbox for the link.", fields };
    }
    return { error: "Incorrect email or password.", fields };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("role, is_active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle<{ role: AppRole; is_active: boolean; must_change_password: boolean }>();
  if (!profile || !profile.is_active) {
    await sb.auth.signOut();
    return { error: "This account has been deactivated. Contact your clinic administrator.", fields };
  }
  if (profile.must_change_password) redirect("/settings?change_password=1");
  redirect(safeNext(form.get("next")) ?? homeFor(profile.role));
}

const SignUp = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: Password,
  consent: z.literal("on", { message: "Please confirm you have read the privacy notice." }),
});

/** Public sign-up creates PATIENT accounts only. Staff accounts are created by a clinic admin. */
export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const fields = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? "") };
  if (overLimit("sign-up", await clientKey(), 5, 60 * 60_000)) {
    return { error: "Too many sign-up attempts from this network. Please try again later.", fields };
  }
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form.", fields };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/confirm?next=/my/link`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Please choose a stronger password.", fields };
    if (error.code === "over_email_send_rate_limit") {
      return { error: "We could not send the confirmation email right now. Please try again in a little while.", fields };
    }
    // Do not reveal whether the email is already registered.
    console.error("[sign-up]", error.code, error.message);
    return { ok: "If this email can be registered, we have sent a confirmation link. Check your inbox." };
  }
  if (data.session) redirect("/my/link");
  return { ok: "Check your inbox: we sent a link to confirm your email address. Then sign in to link your clinic record." };
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (overLimit("reset", await clientKey(), 5, 60 * 60_000)) {
    return { error: "Too many requests. Please try again later.", fields: { email } };
  }
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address.", fields: { email } };
  const sb = await supabaseServer();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/confirm?next=/auth/update-password`,
  });
  if (error) console.error("[reset]", error.code, error.message);
  // Same answer whether or not the account exists (no account enumeration).
  return { ok: "If an account exists for this email, a password reset link is on its way." };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: Password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords do not match.", path: ["confirm"] })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const sb = await supabaseServer();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you have not used before." };
    return { error: "The password could not be changed. Please try again." };
  }
  await sb.from("profiles").update({ must_change_password: false }).eq("id", uid);
  const { data: profile } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle<{ role: AppRole }>();
  if (String(form.get("return") ?? "") === "settings") return { ok: "Your password has been changed." };
  redirect(homeFor(profile?.role ?? "patient"));
}
