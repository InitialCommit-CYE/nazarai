import { CameraOff } from "lucide-react";

import { RETAKE_ADVICE } from "@/lib/clinical";
import type { QualityIssue } from "@/lib/types";

/** Shown when the quality gate rejects an image. No grade is ever produced for these. */
export function QualityFeedback({ issues }: { issues: QualityIssue[] }) {
  const codes = issues.length ? issues.map((i) => i.code) : ["invalid_image"];
  return (
    // A quiet card: the amber stays in the icon and title, the one place it carries meaning.
    <div className="rounded-[20px] border border-white/10 bg-[#121418] p-5" role="alert">
      <h3 className="flex items-start gap-2.5 font-medium text-refer">
        <CameraOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        Photo not suitable for grading: please retake
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        The quality check rejected this image, so no grade was produced. Grading a poor photo could miss disease.
      </p>
      <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
        {codes.map((c) => {
          const advice = RETAKE_ADVICE[c] ?? RETAKE_ADVICE.invalid_image;
          return (
            <li key={c} className="text-sm">
              <p className="font-medium">{advice.en}</p>
              <p dir="rtl" lang="ur" className="urdu mt-1 text-muted-foreground">
                {advice.ur}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
