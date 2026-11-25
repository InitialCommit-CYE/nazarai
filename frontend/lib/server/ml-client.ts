import "server-only";

import type { MetricsResponse, MlPredictResponse } from "@/lib/types";

import { env } from "./env";
import { HttpError } from "./http";

function headers(extra?: HeadersInit): HeadersInit {
  const key = env.mlServiceApiKey();
  return { ...(key ? { "X-API-Key": key } : {}), ...extra };
}

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const url = `${env.mlServiceUrl()}${path}`;
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (err) {
    const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut
        ? "The AI service took too long to respond (it may be waking up). Please try again in a moment."
        : "The AI service is unreachable right now.",
      timedOut ? "ml_timeout" : "ml_unreachable",
    );
  }
}

async function detail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
  } catch {
    return res.statusText;
  }
}

export async function mlPredict(image: Blob, filename: string): Promise<MlPredictResponse> {
  const form = new FormData();
  form.append("image", image, filename);
  const res = await call("/predict", { method: "POST", body: form, headers: headers() }, 90_000);
  if (res.status === 422 || res.status === 415 || res.status === 413) {
    throw new HttpError(422, `The image could not be processed: ${await detail(res)}`, "invalid_image");
  }
  if (res.status === 503) throw new HttpError(503, "The AI model is not loaded on the ML service.", "model_unavailable");
  if (!res.ok) throw new HttpError(502, `AI service error (${res.status}).`, "ml_error");
  return (await res.json()) as MlPredictResponse;
}

export async function mlGeneratePdf(payload: Record<string, unknown>): Promise<ArrayBuffer> {
  const res = await call(
    "/generate-pdf",
    { method: "POST", body: JSON.stringify(payload), headers: headers({ "Content-Type": "application/json" }) },
    30_000,
  );
  if (!res.ok) throw new HttpError(502, `PDF generation failed (${res.status}).`, "pdf_error");
  return res.arrayBuffer();
}

export async function mlMetrics(): Promise<MetricsResponse> {
  const res = await call("/metrics", { headers: headers() }, 15_000);
  if (!res.ok) throw new HttpError(502, `Metrics unavailable (${res.status}).`, "metrics_error");
  return (await res.json()) as MetricsResponse;
}

export interface MlHealth {
  status: string;
  model_loaded: boolean;
  model: { model_version: string; trained: boolean } | null;
  gradcam_available: boolean;
  metrics_available: boolean;
  detail: string | null;
}

export async function mlHealth(): Promise<MlHealth> {
  const res = await call("/health", {}, 10_000);
  if (!res.ok) throw new HttpError(502, `ML health check failed (${res.status}).`, "ml_error");
  return (await res.json()) as MlHealth;
}
