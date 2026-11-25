import "server-only";

import type { Language, ReportResponse, ScreeningRecord } from "@/lib/types";

import { HttpError } from "./http";
import { generateExplanation } from "./report";
import { SCREENING_COLUMNS, supabaseAdmin } from "./supabase";

export async function getGradedScreening(id: string): Promise<ScreeningRecord> {
  const { data, error } = await supabaseAdmin().from("screenings").select(SCREENING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new HttpError(502, "Database error.", "db_error");
  if (!data) throw new HttpError(404, "Screening not found.", "not_found");
  const s = data as ScreeningRecord;
  if (!s.quality_ok || s.grade == null) {
    throw new HttpError(409, "This image was rejected by the quality check, so there is no result to report.", "not_graded");
  }
  return s;
}

/** Return the stored report for this language, generating (and storing) it if needed. */
export async function getOrCreateReport(s: ScreeningRecord, lang: Language, regenerate = false): Promise<ReportResponse> {
  const db = supabaseAdmin();
  if (!regenerate) {
    const { data } = await db
      .from("screening_reports")
      .select("screening_id, language, body, generator, llm_model, created_at")
      .eq("screening_id", s.id)
      .eq("language", lang)
      .maybeSingle();
    if (data) return data as ReportResponse;
  }
  const gen = await generateExplanation(s, lang);
  const { data: saved, error } = await db
    .from("screening_reports")
    .upsert(
      { screening_id: s.id, language: lang, body: gen.body, generator: gen.generator, llm_model: gen.llm_model, created_at: new Date().toISOString() },
      { onConflict: "screening_id,language" },
    )
    .select("screening_id, language, body, generator, llm_model, created_at")
    .single();
  if (error || !saved) {
    console.error("[report] could not store report:", error?.message);
    return { screening_id: s.id, language: lang, ...gen, created_at: new Date().toISOString() };
  }
  return saved as ReportResponse;
}
