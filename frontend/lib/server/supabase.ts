import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "./env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so it lives only in server code and is used ONLY for steps
 * RLS deliberately forbids to users: writing AI results and reports, temporary-upload storage,
 * and staff account creation. Always authorise the caller (lib/server/auth.ts) before using it.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "nazarai-server" } },
    });
  }
  return client;
}

/** Patient identity shown in the patient banner and the worklist (RLS applies to the embedded row too). */
export const PATIENT_SUMMARY_COLUMNS = "id, full_name, mrn, sex, birth_year, diabetes_type, diabetes_since_year";

export const SCREENING_COLUMNS =
  "id, created_at, demo_patient_code, age, diabetes_duration_years, image_source, quality_ok, quality_issues, quality_metrics, grade, grade_label, continuous_score, confidence, referable, urgency, borderline, decision_reason, model_version, model_trained, inference_time_ms, clinic_id, patient_id, referral_status, appointment_at, specialist_note, reviewed_at";

/** Screening columns plus the patient summary, for screens that identify the patient. */
export const SCREENING_WITH_PATIENT = `${SCREENING_COLUMNS}, patient:patients(${PATIENT_SUMMARY_COLUMNS})`;
