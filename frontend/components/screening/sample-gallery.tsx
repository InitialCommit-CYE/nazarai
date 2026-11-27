"use client";

import { Check, ImageOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SampleImage {
  id: string;
  file: string;
  reference_grade: number;
  expected_quality_ok: boolean;
  /** 1-based position in the gallery; set by the gallery, not the manifest. */
  number?: number;
}

interface Manifest {
  attribution: string;
  images: SampleImage[];
}

/* Samples are shown as "Sample 1-6" in a fixed mixed order, so neither the label nor the position gives away
   the dataset grade before the model has read the photo. Presenter key:
   1 = grade 3 · 2 = grade 0 · 3 = unsuitable photo · 4 = grade 2 · 5 = grade 4 · 6 = grade 1 */
const DISPLAY_ORDER = ["grade3-severe", "grade0-no-dr", "unsuitable-low-quality", "grade2-moderate", "grade4-proliferative", "grade1-mild"];

function ordered(images: SampleImage[]): SampleImage[] {
  const rank = (s: SampleImage) => {
    const i = DISPLAY_ORDER.indexOf(s.id);
    return i === -1 ? DISPLAY_ORDER.length : i;
  };
  return [...images].sort((a, b) => rank(a) - rank(b)).map((s, i) => ({ ...s, number: i + 1 }));
}

export function SampleGallery({ selectedId, disabled, onSelect }: { selectedId: string | null; disabled?: boolean; onSelect: (s: SampleImage) => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/demo/manifest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setManifest)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ImageOff className="size-4" /> Sample images could not be loaded.
      </p>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {!manifest &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-square rounded-full" />
            </li>
          ))}
        {manifest &&
          ordered(manifest.images).map((s) => {
          const selected = selectedId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s)}
                aria-pressed={selected}
                aria-label={`Use sample photo ${s.number}`}
                data-sample={s.id}
                className={cn(
                  "group relative block w-full rounded-full text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50",
                )}
              >
                <span className={cn("relative block aspect-square overflow-hidden rounded-full bg-black ring-offset-4 ring-offset-[#0c0e11] transition-shadow duration-200", selected ? "ring-2 ring-foreground" : "ring-1 ring-white/10 group-hover:ring-white/40")}>
                  <Image src={`/demo/${s.file}`} alt="" fill sizes="120px" className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
                </span>
                {selected && (
                  <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
                <span className={cn("mt-2 block text-xs font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                  Sample {s.number}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {manifest && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{manifest.attribution}</p>}
    </div>
  );
}
