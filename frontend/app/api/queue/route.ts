import { connection } from "next/server";

import type { QueueResponse, ScreeningRecord } from "@/lib/types";
import { handleRouteError, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { SCREENING_COLUMNS, supabaseAdmin } from "@/lib/server/supabase";

/** Start of "today" in Pakistan Standard Time (UTC+5, no DST), as an ISO timestamp. */
function startOfTodayPKT(): string {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
  const midnightPkt = Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), nowPkt.getUTCDate());
  return new Date(midnightPkt - PKT_OFFSET_MS).toISOString();
}

/** GET /api/queue?scope=today|all - graded screenings sorted by urgency, plus counts. */
export async function GET(req: Request) {
  await connection();
  const limited = rateLimit(req, "queue", 120, 60_000);
  if (limited) return limited;
  try {
    const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "today";
    const db = supabaseAdmin();
    let q = db
      .from("screenings")
      .select(SCREENING_COLUMNS)
      .order("urgency_rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(300);
    if (scope === "today") q = q.gte("created_at", startOfTodayPKT());
    const { data, error } = await q;
    if (error) throw new HttpError(502, "Could not load the screening queue.", "db_error");

    const rows = (data ?? []) as ScreeningRecord[];
    const graded = rows.filter((r) => r.quality_ok);
    const body: QueueResponse = {
      scope,
      counts: {
        total: rows.length,
        urgent: graded.filter((r) => r.urgency === "urgent").length,
        refer: graded.filter((r) => r.urgency === "refer").length,
        routine: graded.filter((r) => r.urgency === "routine").length,
        rejected: rows.length - graded.length,
      },
      items: rows,
    };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleRouteError(err, "queue");
  }
}
