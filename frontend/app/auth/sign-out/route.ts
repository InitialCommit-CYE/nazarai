import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/** POST only (a GET link could be triggered by prefetching or a third-party page). */
export async function POST(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  } catch {
    /* not configured: nothing to sign out of */
  }
  const to = request.nextUrl.clone();
  to.pathname = "/auth/sign-in";
  to.search = "?signed_out=1";
  return NextResponse.redirect(to, { status: 303 });
}
