import { connection } from "next/server";

import type { HealthResponse } from "@/lib/types";
import { configStatus, env } from "@/lib/server/env";
import { mlHealth } from "@/lib/server/ml-client";
import { supabaseAdmin } from "@/lib/server/supabase";

/** GET /api/health - application, database, storage, ML-service and LLM availability. */
export async function GET() {
  await connection();
  const cfg = configStatus();
  const checks: HealthResponse["checks"] = {
    config: { ok: cfg.ok, detail: cfg.ok ? undefined : `missing: ${cfg.missing.join(", ")}` },
    database: { ok: false },
    storage: { ok: false },
    ml_service: { ok: false },
    llm: {
      ok: true,
      detail: env.anthropicApiKey() ? `Claude (${env.anthropicModel()})` : "ANTHROPIC_API_KEY not set: fixed template reports",
    },
  };

  await Promise.all([
    (async () => {
      try {
        const { error } = await supabaseAdmin().from("screenings").select("id", { count: "exact", head: true });
        checks.database = error ? { ok: false, detail: error.message } : { ok: true };
      } catch (e) {
        checks.database = { ok: false, detail: e instanceof Error ? e.message : "unavailable" };
      }
    })(),
    (async () => {
      try {
        const { data, error } = await supabaseAdmin().storage.getBucket(env.storageBucket());
        checks.storage = error
          ? { ok: false, detail: error.message }
          : { ok: !data.public, detail: data.public ? "bucket must be private" : "private bucket" };
      } catch (e) {
        checks.storage = { ok: false, detail: e instanceof Error ? e.message : "unavailable" };
      }
    })(),
    (async () => {
      try {
        const h = await mlHealth();
        checks.ml_service = {
          ok: h.model_loaded,
          detail: h.model_loaded ? undefined : h.detail ?? "model not loaded",
          model_version: h.model?.model_version,
          model_trained: h.model?.trained,
          gradcam: h.gradcam_available,
        };
      } catch (e) {
        checks.ml_service = { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
      }
    })(),
  ]);

  const ok = Object.values(checks).every((c) => c.ok);
  const body: HealthResponse = { status: ok ? "ok" : "degraded", checks, time: new Date().toISOString() };
  return Response.json(body, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
