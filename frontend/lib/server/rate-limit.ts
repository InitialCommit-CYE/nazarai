import "server-only";

import { clientIp, jsonError } from "./http";

/**
 * Basic fixed-window rate limiter (per server instance, in memory).
 * Good enough to blunt accidental floods on a demo deployment; not a distributed limiter.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(req: Request, name: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  const key = `${name}:${clientIp(req)}`;
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    }
    return null;
  }
  b.count += 1;
  if (b.count > limit) {
    const retry = Math.ceil((b.reset - now) / 1000);
    return jsonError(429, "Too many requests. Please wait a moment and try again.", "rate_limited", {
      "Retry-After": String(retry),
    });
  }
  return null;
}
