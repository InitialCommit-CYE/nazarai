import "server-only";

import { ConfigError } from "./env";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function jsonError(status: number, error: string, code?: string, headers?: HeadersInit) {
  return Response.json({ error, ...(code ? { code } : {}) }, { status, headers });
}

/** Map thrown errors to structured JSON without leaking internals. */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof HttpError) return jsonError(err.status, err.message, err.code);
  if (err instanceof ConfigError) {
    console.error(`[${context}] ${err.message}`);
    return jsonError(503, "The service is not fully configured yet.", "not_configured");
  }
  console.error(`[${context}]`, err instanceof Error ? err.message : err);
  return jsonError(500, "Unexpected server error.", "internal");
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new HttpError(400, "Invalid screening id.", "invalid_id");
  return id.toLowerCase();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
