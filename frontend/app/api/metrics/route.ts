import { connection } from "next/server";

import { mlMetrics } from "@/lib/server/ml-client";

// Byte-for-byte copy of ml/reports/metrics.json, refreshed by scripts/sync-metrics.mjs before every build.
import snapshot from "@/lib/server/data/metrics.json";

/**
 * GET /api/metrics - the real evaluation artefact (ml/reports/metrics.json).
 * Served by the ML service when it is reachable (so it always matches the deployed weights);
 * otherwise the copy bundled at build time. Never substitutes or invents numbers.
 */
export async function GET() {
  await connection();
  try {
    const metrics = await mlMetrics();
    return Response.json(metrics, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", "X-Metrics-Source": "ml-service" },
    });
  } catch {
    return Response.json(snapshot, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", "X-Metrics-Source": "bundled-artefact" },
    });
  }
}
