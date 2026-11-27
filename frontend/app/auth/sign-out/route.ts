import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/** Demo roles the guided demo may hand over to after signing out (see components/site/demo-guide.tsx). */
const SWITCH_TO = new Set(["health-worker", "eye-specialist"]);

/** POST only (a GET link could be triggered by prefetching or a third-party page). */
export async function POST(request: NextRequest) {
  let switchTo: string | null = null;
  try {
    const form = await request.formData();
    const v = form.get("switch");
    if (typeof v === "string" && SWITCH_TO.has(v)) switchTo = v;
  } catch {
    /* no form body */
  }
  try {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  } catch {
    /* not configured: nothing to sign out of */
  }
  const to = request.nextUrl.clone();
  to.pathname = "/auth/sign-in";
  to.search = switchTo ? `?demo=${switchTo}` : "?signed_out=1";
  return NextResponse.redirect(to, { status: 303 });
}
