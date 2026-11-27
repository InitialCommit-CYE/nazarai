import { Info } from "lucide-react";

import { URGENCY_STYLE } from "@/components/clinical/referral-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BORDERLINE_NOTE, CONFIDENCE_LABEL, confidenceLevel, GRADES, LOW_CONFIDENCE_NOTE, URGENCY_INFO } from "@/lib/clinical";
import type { ScreeningRecord, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

import { GradeScale } from "./grade-scale";

type Graded = ScreeningRecord & { grade: number; urgency: Urgency };

/** The instruction itself, written as a sentence the health worker can act on. */
export const DECISION_HEADLINE: Record<Urgency, string> = {
  routine: "No referral. Rescreen in 12 months.",
  refer: "Refer to an eye specialist.",
  urgent: "Refer urgently. Risk to sight.",
};

/** The decision floods a full-colour card: the one moment colour appears on the dark screen. */
export function GradeCard({ s }: { s: Graded }) {
  const style = URGENCY_STYLE[s.urgency];
  const g = GRADES[s.grade];
  const level = confidenceLevel(s.confidence);

  return (
    <section aria-labelledby="decision-title" className="space-y-3">
      <div className={cn("flood-in rounded-[1.75rem] px-6 py-7 sm:px-9 sm:py-9", style.solid)}>
        <p className="text-sm font-semibold opacity-80">Referral decision</p>
        <h2 id="decision-title" className="mt-3 font-display text-[clamp(2.3rem,4.6vw,4.4rem)] leading-[0.92]">
          {DECISION_HEADLINE[s.urgency]}
        </h2>
        <p dir="rtl" lang="ur" className="urdu mt-2 text-xl font-semibold sm:text-2xl">
          {URGENCY_INFO[s.urgency].action.ur}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          <li className={cn("rounded-full px-4 py-2", style.inkChip)}>
            Grade {s.grade} · {g.short}
          </li>
          <li className="glass-light rounded-full px-4 py-2">Confidence: {level ? CONFIDENCE_LABEL[level].toLowerCase() : "–"}</li>
          <li className="glass-light rounded-full px-4 py-2">Photo quality passed</li>
        </ul>
      </div>

      {level === "low" && (
        <div className="glass rounded-2xl p-4 text-sm">
          <p className="font-semibold text-refer">{LOW_CONFIDENCE_NOTE.en}</p>
          <p dir="rtl" lang="ur" className="urdu text-muted-foreground">
            {LOW_CONFIDENCE_NOTE.ur}
          </p>
        </div>
      )}
      {s.borderline && (
        <div className="glass rounded-2xl p-4 text-sm">
          <p className="font-semibold text-refer">{BORDERLINE_NOTE.en}</p>
          <p dir="rtl" lang="ur" className="urdu text-muted-foreground">
            {BORDERLINE_NOTE.ur}
          </p>
        </div>
      )}
    </section>
  );
}

/** Grade, scale and plain-language meaning; sits under the retina. */
export function GradeDetails({ s }: { s: Graded }) {
  const style = URGENCY_STYLE[s.urgency];
  const g = GRADES[s.grade];
  const level = confidenceLevel(s.confidence);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xl font-bold tracking-tight">
          Grade {s.grade} · {g.short}
        </p>
        <p className="text-sm text-muted-foreground">{g.label.en}</p>
      </div>
      <GradeScale score={s.continuous_score ?? s.grade} grade={s.grade} />
      <p className="text-sm leading-relaxed text-ink-muted">{g.explanation.en}</p>
      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.07] pt-4 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="flex items-center gap-1 text-muted-foreground">
            Confidence
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="How confidence is calculated" className="rounded text-muted-foreground hover:text-foreground">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                A heuristic, not a probability. High means the score sits well inside one grade and four flipped views of the
                image agree. Low means those views gave different readings.
              </TooltipContent>
            </Tooltip>
          </dt>
          <dd className={cn("font-semibold", level === "low" && "text-refer")}>{level ? CONFIDENCE_LABEL[level] : "–"}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Referable (grade 2+)</dt>
          <dd className={cn("font-semibold", style.text)}>{s.referable ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </div>
  );
}
