"use client";

import { createContext, useContext } from "react";

import type { ScreeningImages, ScreeningRecord } from "@/lib/types";

export interface ScreeningContextValue {
  screening: ScreeningRecord;
  images: ScreeningImages | null;
}

export const ScreeningContext = createContext<ScreeningContextValue | null>(null);

export function useScreening(): ScreeningContextValue {
  const ctx = useContext(ScreeningContext);
  if (!ctx) throw new Error("useScreening must be used inside ScreeningShell");
  return ctx;
}
