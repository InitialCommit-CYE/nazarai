"use client";

import { ArrowRight, Cpu, Download, FileText, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { QualityFeedback } from "@/components/screening/quality-feedback";
import { LogoMark } from "@/components/site/logo";
import { SafetyDisclaimer } from "@/components/clinical/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pdfUrl } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScreeningRecord, Urgency } from "@/lib/types";

import { CarePlan } from "./care-plan";
import { GradeCard, GradeDetails } from "./grade-card";
import { ReferralPanel } from "./referral-panel";
import { useScreening } from "./screening-context";

export function ResultView() {
  const { screening: s, images, role, update } = useScreening();
  const clinical = role === "operator" || role === "specialist";
  const specialist = role === "specialist";

  if (!s.quality_ok || s.grade == null || !s.urgency) {
    return (
      <div className="max-w-3xl space-y-4">
        <QualityFeedback issues={s.quality_issues} />
        {clinical && (
          <Button asChild>
            <Link href={s.patient_id ? `/screen?patient=${s.patient_id}` : "/screen"}>Retake / choose another image</Link>
          </Button>
        )}
      </div>
    );
  }
  const graded = s as ScreeningRecord & { grade: number; urgency: Urgency };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <GradeCard s={graded} />
        {role === "operator" && <CarePlan screening={s} urgency={graded.urgency} onChange={update} />}
        {specialist && s.referral_status !== "not_required" && <ReferralPanel screening={s} onChange={update} />}
        {role !== "operator" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Next steps</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/screenings/${s.id}/report`}>
                  <FileText /> Patient report <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={pdfUrl(s.id, "ur")} download>
                  <Download /> Slip in Urdu
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={pdfUrl(s.id, "en")} download>
                  <Download /> Slip in English
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
        <SafetyDisclaimer />
      </div>

      <div className="space-y-6">
        <section aria-label="Retina and AI attention" className="rounded-[1.75rem] border border-white/[0.07] bg-surface p-5 sm:p-6">
          <RetinaViewer screeningId={s.id} images={images} />
          <div className="mt-6">
            <GradeDetails s={graded} />
          </div>
        </section>

        <details className="group rounded-3xl border border-white/[0.07] bg-surface p-5 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <ShieldCheck className="size-4" /> Technical details
            <span className="ml-auto text-muted-foreground group-open:hidden">Show</span>
          </summary>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
            <dt>Screened</dt>
            <dd className="text-foreground">{formatDateTime(s.created_at)}</dd>
            <dt>Continuous score</dt>
            <dd className="text-foreground tabular-nums">{s.continuous_score?.toFixed(3)}</dd>
            <dt>Decision rule</dt>
            <dd className="text-foreground">{s.decision_reason}</dd>
            <dt className="flex items-center gap-1">
              <Cpu className="size-3.5" /> Model
            </dt>
            <dd className="break-all text-foreground">{s.model_version}</dd>
            {s.inference_time_ms != null && (
              <>
                <dt>Processing time</dt>
                <dd className="text-foreground">{(s.inference_time_ms / 1000).toFixed(1)} s</dd>
              </>
            )}
          </dl>
        </details>
      </div>
    </div>
  );
}

function RetinaViewer({ screeningId, images }: { screeningId: string; images: { display: string; heatmap?: string | null } | null }) {
  const [heat, setHeat] = useState(true);
  if (!images) {
    return (
      <div>
        <div className="relative mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center">
          <div className="aperture-ring absolute inset-0" />
          <div className="flex size-[86%] flex-col items-center justify-center gap-3 rounded-full border border-dashed border-white/15 bg-white/[0.02] px-10 text-center">
            <LogoMark className="size-10 text-[#5f656d]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              The photo is not kept. Retina images are deleted after grading and shown only in the browser tab that ran the screening.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const showHeat = heat && !!images.heatmap;
  return (
    <div>
      <div className="relative mx-auto flex aspect-square w-full max-w-[26rem] items-center justify-center">
        <div className="aperture-ring absolute inset-0" />
        <Link href={`/screenings/${screeningId}/explain`} className="retina-glow relative block size-[86%] overflow-hidden rounded-full bg-black" aria-label="Open the explainability view">
          {/* eslint-disable-next-line @next/next/no-img-element -- session-only data URL */}
          <img src={images.display} alt="Processed retina photo" className="absolute inset-0 size-full" />
          {images.heatmap && (
            // eslint-disable-next-line @next/next/no-img-element -- session-only data URL
            <img
              src={images.heatmap}
              alt=""
              aria-hidden="true"
              className={cn("absolute inset-0 size-full transition-opacity duration-500", showHeat ? "opacity-60" : "opacity-0")}
            />
          )}
        </Link>
        {images.heatmap && (
          <div className="glass absolute bottom-1 left-1 flex gap-1 rounded-full bg-black/40 p-1 text-xs font-bold" role="group" aria-label="Overlay">
            <button type="button" onClick={() => setHeat(false)} aria-pressed={!showHeat} className={cn("rounded-full px-3 py-1.5", !showHeat ? "bg-primary text-primary-foreground" : "text-ink-muted")}>
              Photo
            </button>
            <button type="button" onClick={() => setHeat(true)} aria-pressed={showHeat} className={cn("rounded-full px-3 py-1.5", showHeat ? "bg-primary text-primary-foreground" : "text-ink-muted")}>
              AI attention
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
        <Layers className="size-4" aria-hidden />
        {images.heatmap ? "Warm areas show where the model looked. A human should check them." : "Grad-CAM unavailable for this result"}
      </p>
    </div>
  );
}
