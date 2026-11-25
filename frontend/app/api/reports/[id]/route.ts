import { z } from "zod";

import { requireApiViewer } from "@/lib/server/auth";
import { assertUuid, handleRouteError, HttpError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { getGradedScreening, getOrCreateReport } from "@/lib/server/screenings";

/**
 * POST /api/reports/[id]  body: { language: "en" | "ur", regenerate?: boolean }
 * Patient-friendly explanation grounded ONLY in the stored model output (Claude, or fixed template).
 */
export const maxDuration = 60;

const Body = z.object({ language: z.enum(["en", "ur"]), regenerate: z.boolean().optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const limited = rateLimit(req, "report", 20, 60_000);
  if (limited) return limited;
  try {
    const { db, viewer } = await requireApiViewer();
    const id = assertUuid((await ctx.params).id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "language must be 'en' or 'ur'.", "invalid_request");
    const screening = await getGradedScreening(db, id);
    const report = await getOrCreateReport(db, screening, parsed.data.language, parsed.data.regenerate && viewer.role !== "patient");
    return Response.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return handleRouteError(err, "reports/[id]");
  }
}
