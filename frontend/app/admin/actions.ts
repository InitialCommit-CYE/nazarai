"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireApiViewer } from "@/lib/server/auth";
import { overLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/server/supabase";

const STAFF_ROLE = z.enum(["operator", "specialist", "admin"]);

/** 14 chars from an unambiguous alphabet, cryptographically random, always with letters + digits. */
function temporaryPassword(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export interface CreateStaffState {
  error?: string;
  created?: { email: string; password: string; name: string };
  values?: Record<string, string>;
}

export async function createStaff(_prev: CreateStaffState, form: FormData): Promise<CreateStaffState> {
  const { viewer } = await requireApiViewer(["admin"]);
  const values = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), role: String(form.get("role") ?? "operator") };
  if (overLimit("create-staff", viewer.id, 20, 60 * 60_000)) return { error: "Too many accounts created in the last hour.", values };
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Enter the staff member's full name.").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      role: STAFF_ROLE,
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form.", values };

  const admin = supabaseAdmin();
  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    const exists = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
    return { error: exists ? "An account with this email already exists." : "The account could not be created. Please try again.", values };
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update({ role: parsed.data.role, clinic_id: viewer.clinicId, full_name: parsed.data.fullName, must_change_password: true })
    .eq("id", data.user.id);
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id); // never leave a half-created account behind
    return { error: "The account could not be set up. Please try again.", values };
  }
  await admin.from("audit_log").insert({
    actor_id: viewer.id,
    clinic_id: viewer.clinicId,
    action: "staff.create",
    entity: "profile",
    entity_id: data.user.id,
    details: { role: parsed.data.role },
  });
  revalidatePath("/admin/staff");
  return { created: { email: parsed.data.email, password, name: parsed.data.fullName } };
}

export async function updateMember(userId: string, role: string, active: boolean): Promise<{ error?: string }> {
  const { db } = await requireApiViewer(["admin"]);
  const r = STAFF_ROLE.safeParse(role);
  if (!r.success) return { error: "Invalid role." };
  const { error } = await db.rpc("admin_update_member", { p_user: userId, p_role: r.data, p_active: active });
  if (error) return { error: error.message.includes("own") ? "You cannot change your own role or status." : "The change could not be saved." };
  revalidatePath("/admin/staff");
  return {};
}

/** Admin-issued temporary password (works without an email provider). Staff must change it at next sign-in. */
export async function resetStaffPassword(userId: string): Promise<{ password?: string; error?: string }> {
  const { viewer, db } = await requireApiViewer(["admin"]);
  if (userId === viewer.id) return { error: "Use Account settings to change your own password." };
  // RLS: an admin can only see staff profiles of their own clinic.
  const { data: target } = await db.from("profiles").select("id, role, clinic_id").eq("id", userId).maybeSingle();
  if (!target || target.role === "patient" || target.clinic_id !== viewer.clinicId) return { error: "Staff member not found." };
  const admin = supabaseAdmin();
  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: "The password could not be reset." };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await admin.from("audit_log").insert({ actor_id: viewer.id, clinic_id: viewer.clinicId, action: "staff.password_reset", entity: "profile", entity_id: userId });
  return { password };
}
