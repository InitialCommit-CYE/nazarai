"use client";

import type { ScreeningRecord } from "@/lib/types";

/**
 * The screening page already has the saved record when it opens the result, so it hands it over here and the
 * result renders on arrival instead of waiting for a second request. The result page still refetches in the
 * background. In-memory only: a reload simply fetches as usual.
 */
const primed = new Map<string, ScreeningRecord>();

export function primeScreening(record: ScreeningRecord) {
  primed.clear();
  primed.set(record.id, record);
}

export function primedScreening(id: string): ScreeningRecord | null {
  return primed.get(id) ?? null;
}
