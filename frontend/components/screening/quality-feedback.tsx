import { CameraOff } from "lucide-react";

import { RETAKE_ADVICE } from "@/lib/clinical";
import type { QualityIssue } from "@/lib/types";

/** Shown when the quality gate rejects an image. No grade is ever produced for these. */
export function QualityFeedback({ issues }: { issues: QualityIssue[] }) {
  const codes = issues.length ? issues.map((i) => i.code) : ["invalid_image"];
  return (
    <div className="rounded-2xl border border-refer/40 bg-refer-soft p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-refer text-white">
          <CameraOff className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="font-semibold">Photo not suitable for grading: please retake</h3>
            <p className="text-sm text-muted-foreground">
              The quality check rejected this image, so no grade was produced. Grading a poor photo could miss disease.
            </p>
          </div>
          <ul className="space-y-3">
            {codes.map((c) => {
              const advice = RETAKE_ADVICE[c] ?? RETAKE_ADVICE.invalid_image;
              return (
                <li key={c} className="rounded-xl bg-background/70 p-3 text-sm">
                  <p className="font-medium">{advice.en}</p>
                  <p dir="rtl" lang="ur" className="urdu mt-1 text-muted-foreground">
                    {advice.ur}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
