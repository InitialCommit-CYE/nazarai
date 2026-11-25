import { z } from "zod";

import type { ScreeningRecord, ScreenResponse } from "@/lib/types";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireApiViewer } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { handleRouteError, HttpError } from "@/lib/server/http";
import { mlPredict } from "@/lib/server/ml-client";
import { rateLimit } from "@/lib/server/rate-limit";
import { SCREENING_COLUMNS, supabaseAdmin } from "@/lib/server/supabase";

/**
 * POST /api/screen
 * 0. signed-in clinical staff only; the patient must be visible to them through RLS (same clinic)
 * 1. validates the temporary storage path   2. downloads the image server-side
 * 3. calls the FastAPI ML service           4. deletes the temporary upload (always)
 * 5. stores the screening metadata          6. returns result + images (images are NOT stored)
 */
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;

const Body = z.object({
  uploadPath: z.string().regex(/^incoming\/[0-9a-f-]{36}\.(jpg|png|webp)$/i),
  imageSource: z.enum(["upload", "sample", "camera"]).default("upload"),
  patientId: z.string().uuid(),
});

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function POST(req: Request) {
  const limited = rateLimit(req, "screen", 12, 60_000);
  if (limited) return limited;

  let uploadPath: string | null = null;

  try {
    const { viewer, db } = await requireApiViewer(CLINICAL_ROLES);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      throw new HttpError(400, `Invalid screening request: ${msg}`, "invalid_request");
    }
    const body = parsed.data;
    uploadPath = body.uploadPath;

    // RLS returns the patient only if they belong to the caller's clinic.
    const { data: patient } = await db
      .from("patients")
      .select("id, clinic_id, mrn, birth_year, diabetes_since_year")
      .eq("id", body.patientId)
      .maybeSingle<{ id: string; clinic_id: string; mrn: string; birth_year: number; diabetes_since_year: number | null }>();
    if (!patient) throw new HttpError(404, "Patient not found in your clinic.", "patient_not_found");
    const year = new Date().getUTCFullYear();

    const bucket = supabaseAdmin().storage.from(env.storageBucket());
    const { data: blob, error: dlErr } = await bucket.download(uploadPath);
    if (dlErr || !blob) throw new HttpError(404, "Uploaded image not found or expired. Please upload again.", "upload_missing");
    if (blob.size === 0 || blob.size > MAX_BYTES) throw new HttpError(413, "Image must be between 1 byte and 10 MB.", "invalid_size");

    const ext = uploadPath.split(".").pop()!.toLowerCase();
    const typed = new Blob([await blob.arrayBuffer()], { type: MIME[ext] });
    const result = await mlPredict(typed, `fundus.${ext}`);

    if (!result.model.trained && !env.allowUntrainedModel()) {
      throw new HttpError(
        503,
        "The ML service is running an untrained development model. Real predictions are unavailable until the trained model is deployed.",
        "untrained_model",
      );
    }

    const q = result.quality;
    const g = q.ok ? result.grading : null;
    if (q.ok && !g) throw new HttpError(502, "The AI service returned an incomplete result.", "ml_incomplete");

    const { ok: _ok, issues, ...metrics } = q;
    void _ok;
    const row = {
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      created_by: viewer.id,
      demo_patient_code: patient.mrn,
      age: Math.max(0, Math.min(120, year - patient.birth_year)),
      diabetes_duration_years: patient.diabetes_since_year ? Math.max(0, Math.min(100, year - patient.diabetes_since_year)) : null,
      image_source: body.imageSource,
      quality_ok: q.ok,
      quality_issues: issues,
      quality_metrics: metrics,
      grade: g?.grade ?? null,
      grade_label: g?.grade_label ?? null,
      continuous_score: g?.continuous_score ?? null,
      confidence: g?.confidence ?? null,
      referable: g ? g.referable : null,
      urgency: g?.urgency ?? null,
      borderline: g ? g.borderline : null,
      decision_reason: g?.decision_reason ?? null,
      model_version: result.model.model_version,
      model_trained: result.model.trained,
      inference_time_ms: result.timings_ms.total ?? result.timings_ms.quality ?? null,
    };
    const { data: saved, error: insErr } = await supabaseAdmin()
      .from("screenings")
      .insert(row)
      .select(SCREENING_COLUMNS)
      .single();
    if (insErr || !saved) {
      console.error("[screen] insert failed:", insErr?.message);
      throw new HttpError(502, "The result could not be saved to the database. Please retry.", "db_error");
    }

    const img = result.images;
    const response: ScreenResponse = {
      screening: saved as ScreeningRecord,
      images: img
        ? {
            display: `data:image/png;base64,${img.display_png_base64}`,
            processed: `data:image/png;base64,${img.processed_png_base64}`,
            heatmap: img.heatmap_png_base64 ? `data:image/png;base64,${img.heatmap_png_base64}` : null,
          }
        : null,
      timings_ms: result.timings_ms,
    };
    return Response.json(response, { status: 201 });
  } catch (err) {
    return handleRouteError(err, "screen");
  } finally {
    // Temporary upload is deleted whatever happened above. Retinal images are never kept.
    if (uploadPath) {
      try {
        const { error } = await supabaseAdmin().storage.from(env.storageBucket()).remove([uploadPath]);
        if (error) console.error("[screen] failed to delete temporary upload:", error.message);
      } catch {
        /* configuration error already reported */
      }
    }
  }
}
