"use client";

import { useSyncExternalStore } from "react";

import { loadSampleReference } from "@/lib/client/sample-reference";
import { GRADES } from "@/lib/clinical";
import type { ScreeningRecord, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** The referral the expert grade implies, with the same rule the app uses (0-1 routine, 2 refer, 3-4 urgent). */
function urgencyFor(grade: number): Urgency {
  return grade >= 3 ? "urgent" : grade === 2 ? "refer" : "routine";
}

/**
 * "Check it yourself": for a bundled IDRiD sample, the dataset's expert label next to NazarAI's reading.
 * Shown only on the result, never in the gallery, and stated plainly whether they agree.
 */
export function DatasetCheck({ s }: { s: ScreeningRecord & { grade: number; urgency: Urgency } }) {
  const ref = useSyncExternalStore(noop, () => sampleRefKey(s.id), () => "");
  if (!ref) return null;
  const [number, grade] = ref.split(":").map(Number) as [number, number];
  const sameGrade = grade === s.grade;
  const sameAction = urgencyFor(grade) === s.urgency;
  const verdict = sameGrade
    ? "Same grade as the experts"
    : sameAction
      ? `Same referral decision; the grade differs by ${Math.abs(grade - s.grade)}`
      : s.referable && grade < 2
        ? "NazarAI refers where the experts would not: the safe direction"
        : "Differs from the experts’ referral decision";
  const good = sameGrade || sameAction || (s.referable && grade < 2);

  return (
    <div className="rounded-[20px] border border-white/10 bg-[#121418] p-5 text-[0.9375rem]">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">Check it yourself</p>
      <p className="mt-2 leading-relaxed text-ink-muted">
        This was Sample {number} from the public IDRiD dataset. Its expert label is{" "}
        <span className="font-medium text-foreground">
          grade {grade} · {GRADES[grade]?.short}
        </span>
        . NazarAI read{" "}
        <span className="font-medium text-foreground">
          grade {s.grade} · {GRADES[s.grade]?.short}
        </span>
        .
      </p>
      <p className="mt-3 flex items-center gap-2 font-medium">
        <span className={cn("size-2 rounded-full", good ? "bg-routine" : "bg-refer")} aria-hidden />
        {verdict}
      </p>
    </div>
  );
}

/** A primitive snapshot for useSyncExternalStore: "number:grade", or "" when this was not a sample. */
function sampleRefKey(id: string): string {
  const r = loadSampleReference(id);
  return r ? `${r.number}:${r.grade}` : "";
}
