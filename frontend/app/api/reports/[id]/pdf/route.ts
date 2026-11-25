import { assertUuid, handleRouteError } from "@/lib/server/http";
import { mlGeneratePdf } from "@/lib/server/ml-client";
import { rateLimit } from "@/lib/server/rate-limit";
import { getGradedScreening, getOrCreateReport } from "@/lib/server/screenings";

/** GET /api/reports/[id]/pdf?lang=en|ur - downloadable referral slip (rendered by the ML service). */
export const maxDuration = 60;

export async function GET(req: Request, ctx: RouteContext<"/api/reports/[id]/pdf">) {
  const limited = rateLimit(req, "pdf", 20, 60_000);
  if (limited) return limited;
  try {
    const id = assertUuid((await ctx.params).id);
    const lang = new URL(req.url).searchParams.get("lang") === "ur" ? "ur" : "en";
    const s = await getGradedScreening(id);
    const report = await getOrCreateReport(s, lang);
    const pdf = await mlGeneratePdf({
      screening_id: s.id,
      created_at: s.created_at,
      demo_patient_code: s.demo_patient_code,
      age: s.age,
      diabetes_duration_years: s.diabetes_duration_years,
      grade: s.grade,
      grade_label: s.grade_label,
      confidence: s.confidence,
      referable: s.referable,
      urgency: s.urgency,
      model_version: s.model_version,
      is_development_model: !s.model_trained,
      language: lang,
      report_text: report.body,
    });
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nazarai-referral-${s.id.slice(0, 8)}-${lang}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err, "reports/[id]/pdf");
  }
}
