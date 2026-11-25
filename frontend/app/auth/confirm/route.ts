import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Landing route for links in Supabase emails (sign-up confirmation, password recovery).
 * Supports both token_hash links and PKCE ?code= links, then continues to a SAFE relative path.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const sb = await supabaseServer();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await sb.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
  } else {
    dest.pathname = "/auth/sign-in";
    dest.searchParams.set("error", "link");
  }
  return NextResponse.redirect(dest);
}
