"use client";

import type { ScreeningImages } from "@/lib/types";

/**
 * Retinal images are never stored on the server. The processed image and Grad-CAM heatmap
 * returned by /api/screen are kept only in this browser tab's sessionStorage (last few
 * screenings), and disappear when the tab closes.
 */
const KEY = "nazarai.images.v1";
const MAX_ENTRIES = 4;

type Store = { id: string; images: ScreeningImages }[];

function read(): Store {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Store;
  } catch {
    return [];
  }
}

export function saveSessionImages(id: string, images: ScreeningImages) {
  let store = [{ id, images }, ...read().filter((e) => e.id !== id)].slice(0, MAX_ENTRIES);
  while (store.length) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(store));
      return;
    } catch {
      store = store.slice(0, -1); // quota exceeded: drop the oldest
    }
  }
}

export function loadSessionImages(id: string): ScreeningImages | null {
  return read().find((e) => e.id === id)?.images ?? null;
}
