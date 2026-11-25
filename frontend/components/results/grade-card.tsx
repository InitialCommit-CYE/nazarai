import { Info } from "lucide-react";

import { URGENCY_STYLE } from "@/components/clinical/referral-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BORDERLINE_NOTE, GRADES, URGENCY_INFO } from "@/lib/clinical";
import { pct } from "@/lib/format";
import type { ScreeningRecord, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

import { GradeScale } from "./grade-scale";

export function GradeCard({ s }: { s: ScreeningRecord & { grade: number; urgency: Urgency } }) {
  const style = URGENCY_STYLE[s.urgency];
  const Icon = style.icon;
  const g = GRADES[s.grade];

  return (
    <section
      aria-labelledby="decision-title"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
    >
      {/* Decision banner: what to do, in both languages */}
      <div className={cn("flex items-start gap-4 p-5 sm:p-6", style.solid)}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-90">Referral decision</p>
          <h2 id="decision-title" className="text-2xl font-semibold tracking-tight">
            {URGENCY_INFO[s.urgency].title.en}
          </h2>
          <p className="mt-1 text-white/95">{URGENCY_INFO[s.urgency].action.en}</p>
          <p dir="rtl" lang="ur" className="urdu mt-1 text-base text-white/95">
            {URGENCY_INFO[s.urgency].action.ur}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">AI-estimated DR grade</p>
          <p className="text-3xl font-semibold tracking-tight">
            Grade {s.grade} <span className="text-muted-foreground">·</span> {g.short}
          </p>
          <p className="text-sm text-muted-foreground">{g.label.en}</p>
          <p className="pt-2 text-sm leading-relaxed">{g.explanation.en}</p>
        </div>
        <div className="space-y-5">
          <GradeScale score={s.continuous_score ?? s.grade} grade={s.grade} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                Model confidence
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="How confidence is calculated" className="rounded text-muted-foreground hover:text-foreground">
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    Heuristic, not a calibrated probability: combines distance from the nearest grade boundary with agreement
                    between four flipped views of the image.
                  </TooltipContent>
                </Tooltip>
              </dt>
              <dd className="mt-0.5 text-lg font-semibold">{pct(s.confidence, 0)}</dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Referable DR (grade ≥ 2)</dt>
              <dd className={cn("mt-0.5 text-lg font-semibold", style.text)}>{s.referable ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {s.borderline && (
        <div className="mx-5 mb-5 rounded-xl border border-refer/40 bg-refer-soft p-3 text-sm sm:mx-6">
          <p className="font-medium">{BORDERLINE_NOTE.en}</p>
          <p dir="rtl" lang="ur" className="urdu text-muted-foreground">
            {BORDERLINE_NOTE.ur}
          </p>
        </div>
      )}
    </section>
  );
}
