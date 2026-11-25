"use client";

import type {
  ApiErrorBody,
  ImageSource,
  Language,
  MetricsResponse,
  QueueResponse,
  ReportResponse,
  ScreeningRecord,
  ScreenResponse,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "Network error. Check your connection and try again.", "network");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status}).`, body?.code);
  }
  return (await res.json()) as T;
}

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size > MAX_UPLOAD_BYTES) return "The image is larger than 10 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

/** Upload straight to the private Supabase bucket via a short-lived signed URL, with progress. */
function putToSignedUrl(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "60");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "Upload to secure storage failed. Please try again.", "upload_failed"));
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload.", "network"));
    xhr.send(form);
  });
}

export async function uploadImage(file: File, onProgress: (pct: number) => void): Promise<string> {
  const signed = await request<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  await putToSignedUrl(signed.signedUrl, file, onProgress);
  return signed.path;
}

export interface PatientFields {
  demoPatientCode?: string;
  age?: number;
  diabetesDurationYears?: number;
}

export function runScreening(uploadPath: string, imageSource: ImageSource, patient: PatientFields) {
  return request<ScreenResponse>("/api/screen", {
    method: "POST",
    body: JSON.stringify({ uploadPath, imageSource, ...patient }),
  });
}

export function getScreening(id: string) {
  return request<{ screening: ScreeningRecord }>(`/api/screenings/${id}`);
}

export function getReport(id: string, language: Language, regenerate = false) {
  return request<ReportResponse>(`/api/reports/${id}`, { method: "POST", body: JSON.stringify({ language, regenerate }) });
}

export function pdfUrl(id: string, language: Language) {
  return `/api/reports/${id}/pdf?lang=${language}`;
}

export function getQueue(scope: "today" | "all") {
  return request<QueueResponse>(`/api/queue?scope=${scope}`);
}

export function getMetrics() {
  return request<MetricsResponse>("/api/metrics");
}
