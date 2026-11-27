import { NextResponse, type NextRequest } from "next/server";

import { DEMO_LANDING } from "@/lib/demo";
import { demoAccountFor } from "@/lib/server/demo-accounts";
import { rateLimit } from "@/lib/server/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

/** Only same-site relative paths, never back into /auth, never protocol-relative (open redirect). */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/auth")) return null;
  return next;
}

/**
 * GET /auth/demo?as=health-worker|eye-specialist[&next=/same-site/path]
 * One click from the landing page into the demo clinic: signs in as the shared demo account on the server and
 * redirects straight to the work (the screening page or the referral worklist). No sign-in form is shown.
 *
 * Linked with a plain <a>, never next/link, so it is never prefetched. Prefetches and cross-site requests are
 * refused anyway, so a third-party page cannot switch a signed-in user into the demo account.
 */
export async function GET(request: NextRequest) {
  const purpose = `${request.headers.get("sec-purpose") ?? ""} ${request.headers.get("purpose") ?? ""}`;
  if (purpose.includes("prefetch") || request.headers.has("next-router-prefetch")) {
    return new NextResponse(null, { status: 204 });
  }
  const slug = request.nextUrl.searchParams.get("as") ?? "";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (request.headers.get("sec-fetch-site") === "cross-site") return to("/auth/sign-in");
  const limited = rateLimit(request, "demo-sign-in", 20, 60_000);
  if (limited) return limited;

  const account = demoAccountFor(slug);
  const landing = safeNext(request.nextUrl.searchParams.get("next")) ?? DEMO_LANDING[slug];
  if (!account || !landing) return to("/auth/sign-in");

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signInWithPassword({ email: account.email, password: account.password });
    if (error || !data.user) throw error ?? new Error("no user");
  } catch (err) {
    console.error("[demo] one-click sign-in failed:", err instanceof Error ? err.message : err);
    // Fall back to the sign-in page, which retries the same account from the browser.
    return to(`/auth/sign-in?demo=${encodeURIComponent(slug)}`);
  }
  return to(landing);
}
