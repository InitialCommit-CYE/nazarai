"use client";

/**
 * When a screening used one of the bundled IDRiD sample photos, the result can show that photo's expert label next to
 * NazarAI's reading, so a visitor can check the model for themselves. The label is only shown after the result (the
 * gallery never gives it away), and lives in this tab's sessionStorage beside the session-only images.
 */
const KEY = "nazarai.samples.v1";

export interface SampleReference {
  /** 1-based position in the gallery ("Sample 4"). */
  number: number;
  /** The dataset's expert grade, 0-4. */
  grade: number;
}

function read(): Record<string, SampleReference> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, SampleReference>;
  } catch {
    return {};
  }
}

export function saveSampleReference(screeningId: string, ref: SampleReference) {
  try {
    const all = read();
    all[screeningId] = ref;
    // Keep it small: the last 10 screenings are plenty for one visit.
    const recent = Object.fromEntries(Object.entries(all).slice(-10));
    sessionStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    /* storage blocked: the result simply shows no dataset label */
  }
}

export function loadSampleReference(screeningId: string): SampleReference | null {
  if (typeof window === "undefined") return null;
  return read()[screeningId] ?? null;
}
