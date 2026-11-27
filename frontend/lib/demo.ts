/** Shared by server and client code (no secrets here). */

/** "Health worker" -> "health-worker": the value used in one-click demo links. */
export function demoSlug(role: string): string {
  return role.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The shared demo-clinic accounts all use this email domain. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@demo.nazarai.app");
}

/** The five seeded demo patients that the guide, the video and every judge rely on. */
export function isSeededDemoPatient(mrn: string | null | undefined): boolean {
  return !!mrn && /^DEMO-100[1-5]$/.test(mrn);
}

/** Where a one-click demo visitor lands: straight into the job, not a dashboard. */
export const DEMO_LANDING: Record<string, string> = {
  "health-worker": "/screen",
  "eye-specialist": "/queue",
};

/** The one-click link: signs in as a demo role on the server and redirects, with no sign-in form in between. */
export function demoHref(slug: "health-worker" | "eye-specialist"): string {
  return `/auth/demo?as=${slug}`;
}
