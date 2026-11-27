import { readFile } from "node:fs/promises";
import path from "node:path";

import { after } from "next/server";
import { z } from "zod";

import type { ScreeningRecord, ScreenResponse } from "@/lib/types";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireApiViewer } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { handleRouteError, HttpError } from "@/lib/server/http";
import { mlPredict } from "@/lib/server/ml-client";
import { rateLimit } from "@/lib/server/rate-limit";
import { SCREENING_WITH_PATIENT, supabaseAdmin } from "@/lib/server/supabase";

/**
 * POST /api/screen
 * 0. signed-in clinical staff only; the patient must be visible to them through RLS (same clinic)
 * 1. validates the temporary storage path   2. downloads the image server-side
 * 3. calls the FastAPI ML service           4. deletes the temporary upload (always, after the response)
 * 5. stores the screening metadata          6. returns result + images (images are NOT stored)
 *
 * Sample photos from the public dataset skip steps 1, 2 and 4: the server reads its own copy (public/demo),
 * so the browser does not upload what the server already has. That is the path every judge takes.
 */
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;

/** The bundled IDRiD sample photos (public/demo/<id>.jpg, listed in public/demo/manifest.json). */
const SAMPLE_IDS = ["grade0-no-dr", "grade1-mild", "grade2-moderate", "grade3-severe", "grade4-proliferative", "unsuitable-low-quality"] as const;

const Body = z
  .object({
    uploadPath: z.string().regex(/^incoming\/[0-9a-f-]{36}\.(jpg|png|webp)$/i).optional(),
    sampleId: z.enum(SAMPLE_IDS).optional(),
    imageSource: z.enum(["upload", "sample", "camera"]).default("upload"),
    patientId: z.string().uuid(),
  })
  .refine((b) => !!b.uploadPath !== !!b.sampleId, { message: "send either an upload or a sample photo" });

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
    uploadPath = body.uploadPath ?? null;

    // The patient check (RLS returns the patient only if they belong to the caller's clinic) and fetching the
    // image are independent, so they run side by side.
    const [{ data: patient }, image] = await Promise.all([
      db
        .from("patients")
        .select("id, clinic_id, mrn, birth_year, diabetes_since_year")
        .eq("id", body.patientId)
        .maybeSingle<{ id: string; clinic_id: string; mrn: string; birth_year: number; diabetes_since_year: number | null }>(),
      body.sampleId ? readSample(body.sampleId) : downloadUpload(uploadPath!),
    ]);
    if (!patient) throw new HttpError(404, "Patient not found in your clinic.", "patient_not_found");
    const year = new Date().getUTCFullYear();

    const result = await mlPredict(image.blob, image.filename);

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
      image_source: body.sampleId ? "sample" : body.imageSource,
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
      .select(SCREENING_WITH_PATIENT)
      .single();
    if (insErr || !saved) {
      console.error("[screen] insert failed:", insErr?.message);
      throw new HttpError(502, "The result could not be saved to the database. Please retry.", "db_error");
    }

    const img = result.images;
    const response: ScreenResponse = {
      screening: saved as unknown as ScreeningRecord,
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
    // The temporary upload is deleted whatever happened above, right after the response is sent (so the
    // health worker does not wait for it). Retinal images are never kept.
    const toDelete = uploadPath;
    if (toDelete) {
      after(async () => {
        try {
          const { error } = await supabaseAdmin().storage.from(env.storageBucket()).remove([toDelete]);
          if (error) console.error("[screen] failed to delete temporary upload:", error.message);
        } catch {
          /* configuration error already reported */
        }
      });
    }
  }
}

async function readSample(id: (typeof SAMPLE_IDS)[number]): Promise<{ blob: Blob; filename: string }> {
  const bytes = await readFile(path.join(process.cwd(), "public", "demo", `${id}.jpg`));
  return { blob: new Blob([bytes], { type: "image/jpeg" }), filename: "fundus.jpg" };
}

async function downloadUpload(uploadPath: string): Promise<{ blob: Blob; filename: string }> {
  const { data: blob, error } = await supabaseAdmin().storage.from(env.storageBucket()).download(uploadPath);
  if (error || !blob) throw new HttpError(404, "Uploaded image not found or expired. Please upload again.", "upload_missing");
  if (blob.size === 0 || blob.size > MAX_BYTES) throw new HttpError(413, "Image must be between 1 byte and 10 MB.", "invalid_size");
  const ext = uploadPath.split(".").pop()!.toLowerCase();
  return { blob: new Blob([await blob.arrayBuffer()], { type: MIME[ext] }), filename: `fundus.${ext}` };
}
