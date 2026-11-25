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
}

interface Manifest {
  attribution: string;
  images: SampleImage[];
}

function label(s: SampleImage) {
  if (!s.expected_quality_ok) return { title: "Unsuitable photo", sub: "Low quality: should be rejected" };
  return { title: `Dataset label: grade ${s.reference_grade}`, sub: ["No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"][s.reference_grade] };
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
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {!manifest &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-square rounded-xl" />
            </li>
          ))}
        {manifest?.images.map((s) => {
          const l = label(s);
          const selected = selectedId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s)}
                aria-pressed={selected}
                aria-label={`Use sample image: ${l.title}, ${l.sub}`}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-xl border bg-black text-left transition outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-60",
                  selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/60",
                )}
              >
                <span className="relative block aspect-square">
                  <Image src={`/demo/${s.file}`} alt="" fill sizes="120px" className="object-cover transition-transform group-hover:scale-105" />
                </span>
                {selected && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pt-4 pb-1.5 text-[10px] leading-tight font-medium text-white">
                  {s.expected_quality_ok ? `Grade ${s.reference_grade}` : "Unsuitable"}
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
