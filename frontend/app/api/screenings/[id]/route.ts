import { requireApiViewer } from "@/lib/server/auth";
import { assertUuid, handleRouteError, HttpError } from "@/lib/server/http";
import { SCREENING_COLUMNS } from "@/lib/server/supabase";

/** GET /api/screenings/[id] - stored screening metadata (no images are ever stored). RLS-scoped. */
export async function GET(_req: Request, ctx: RouteContext<"/api/screenings/[id]">) {
  try {
    const { db } = await requireApiViewer();
    const id = assertUuid((await ctx.params).id);
    const { data, error } = await db.from("screenings").select(SCREENING_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new HttpError(502, "Database error.", "db_error");
    if (!data) throw new HttpError(404, "Screening not found.", "not_found");
    return Response.json({ screening: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return handleRouteError(err, "screenings/[id]");
  }
}
