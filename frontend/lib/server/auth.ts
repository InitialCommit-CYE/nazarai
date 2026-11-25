import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { homeFor, type AppRole } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabase/server";

import { HttpError } from "./http";

export interface Viewer {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  clinicId: string | null;
  clinicName: string | null;
  active: boolean;
  mustChangePassword: boolean;
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  clinic_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  clinics: { name: string } | null;
};

/**
 * Data Access Layer: the one place that turns the session cookie into a verified user + profile.
 * getClaims() verifies the JWT signature; the profile is read through RLS (users can read only
 * their own profile and colleagues). Deduplicated per request with React cache().
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let sb;
  try {
    sb = await supabaseServer();
  } catch {
    return null; // Supabase not configured: everyone is anonymous
  }
  const { data, error } = await sb.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const { data: p } = await sb
    .from("profiles")
    .select("id, email, full_name, role, clinic_id, is_active, must_change_password, clinics(name)")
    .eq("id", sub)
    .maybeSingle<ProfileRow>();
  if (!p) return null;
  return {
    id: p.id,
    email: p.email ?? (typeof data.claims.email === "string" ? data.claims.email : ""),
    fullName: p.full_name,
    role: p.role,
    clinicId: p.clinic_id,
    clinicName: p.clinics?.name ?? null,
    active: p.is_active,
    mustChangePassword: p.must_change_password,
  };
});

/** For pages: redirect to sign-in (or to the user's home) unless the viewer may see this page. */
export async function requireViewer(opts: { next: string; roles?: AppRole[]; allowPasswordChange?: boolean }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(opts.next)}`);
  if (!viewer.active) redirect("/auth/sign-in?error=inactive");
  if (viewer.mustChangePassword && !opts.allowPasswordChange) redirect("/settings?change_password=1");
  if (opts.roles && !opts.roles.includes(viewer.role)) redirect(homeFor(viewer.role));
  return { viewer, db: await supabaseServer() };
}

/** For route handlers: 401/403 JSON errors instead of redirects. */
export async function requireApiViewer(roles?: AppRole[]) {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, "Please sign in to continue.", "unauthenticated");
  if (!viewer.active) throw new HttpError(403, "This account has been deactivated.", "inactive");
  if (roles && !roles.includes(viewer.role)) throw new HttpError(403, "Your role does not allow this action.", "forbidden");
  return { viewer, db: await supabaseServer() };
}
