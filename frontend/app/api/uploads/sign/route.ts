import { z } from "zod";

import { env } from "@/lib/server/env";
import { handleRouteError, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/server/supabase";

/**
 * POST /api/uploads/sign
 * Mints a short-lived signed upload URL for the PRIVATE retina-uploads bucket, so the browser
 * uploads directly to Supabase Storage (no large bodies through Vercel, no credentials in the browser).
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const Body = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

let lastSweep = 0;
const STALE_MS = 15 * 60 * 1000;

/** Delete uploads that were never screened (e.g. the tab was closed). Throttled, best effort. */
async function sweepStaleUploads() {
  if (Date.now() - lastSweep < 10 * 60 * 1000) return;
  lastSweep = Date.now();
  const bucket = supabaseAdmin().storage.from(env.storageBucket());
  const { data, error } = await bucket.list("incoming", { limit: 100, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return;
  const stale = data
    .filter((o) => o.created_at && Date.now() - new Date(o.created_at).getTime() > STALE_MS)
    .map((o) => `incoming/${o.name}`);
  if (stale.length) {
    const { error: rmErr } = await bucket.remove(stale);
    if (!rmErr) console.info(`[uploads] swept ${stale.length} stale temporary uploads`);
  }
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "sign", 30, 60_000);
  if (limited) return limited;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, "Upload a JPEG, PNG or WebP image no larger than 10 MB.", "invalid_upload");
    }
    const path = `incoming/${crypto.randomUUID()}.${EXT[parsed.data.contentType]}`;
    const { data, error } = await supabaseAdmin().storage.from(env.storageBucket()).createSignedUploadUrl(path);
    if (error || !data) throw new HttpError(502, "Could not prepare the upload. Please try again.", "storage_error");
    sweepStaleUploads().catch(() => undefined);
    return Response.json({ path: data.path, token: data.token, signedUrl: data.signedUrl, bucket: env.storageBucket() });
  } catch (err) {
    return handleRouteError(err, "uploads/sign");
  }
}
