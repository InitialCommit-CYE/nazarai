import { connection } from "next/server";

import type { MetricsResponse } from "@/lib/types";
import { ConfigError } from "@/lib/server/env";
import { mlMetrics } from "@/lib/server/ml-client";

/**
 * GET /api/metrics - the real evaluation artefact (ml/reports/metrics.json) served by the ML
 * service. Never substitutes numbers: if unavailable, returns an honest pending/unavailable state.
 */
export async function GET() {
  await connection();
  try {
    const metrics = await mlMetrics();
    return Response.json(metrics, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    const body: MetricsResponse = {
      status: "unavailable",
      detail:
        err instanceof ConfigError
          ? "The ML service is not configured, so evaluation results cannot be loaded."
          : "The ML service could not be reached, so evaluation results cannot be loaded right now.",
    };
    return Response.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
