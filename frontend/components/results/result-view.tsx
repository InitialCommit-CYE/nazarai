"use client";

import { ArrowRight, Cpu, Download, FileText, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { QualityFeedback } from "@/components/screening/quality-feedback";
import { SafetyDisclaimer } from "@/components/clinical/notices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pdfUrl } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";
import type { ScreeningRecord, Urgency } from "@/lib/types";

import { GradeCard } from "./grade-card";
import { ReferralPanel } from "./referral-panel";
import { useScreening } from "./screening-context";

export function ResultView() {
  const { screening: s, images, role, update } = useScreening();
  const clinical = role === "operator" || role === "specialist";

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
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-6">
        <GradeCard s={graded} />
        <SafetyDisclaimer />
      </div>

      <div className="space-y-6">
        {clinical && s.referral_status !== "not_required" && <ReferralPanel screening={s} role={role} onChange={update} />}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Retina & AI attention
              <Button asChild variant="ghost" size="sm">
                <Link href={`/screenings/${s.id}/explain`}>
                  Open <ArrowRight />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {images ? (
              <Link href={`/screenings/${s.id}/explain`} className="group block">
                <div className="relative mx-auto aspect-square max-w-xs overflow-hidden rounded-full bg-black ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- session-only data URL */}
                  <img src={images.display} alt="Processed retina photo" className="absolute inset-0 size-full" />
                  {images.heatmap && (
                    // eslint-disable-next-line @next/next/no-img-element -- session-only data URL
                    <img src={images.heatmap} alt="" aria-hidden="true" className="absolute inset-0 size-full opacity-55 transition-opacity group-hover:opacity-80" />
                  )}
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Layers className="size-4" /> {images.heatmap ? "Grad-CAM overlay: tap to explore" : "Grad-CAM unavailable for this result"}
                </p>
              </Link>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Retinal images are never stored on the server. They are shown only in the browser tab that ran the
                screening, so they are not available here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild size="lg" className="justify-between">
              <Link href={`/screenings/${s.id}/report`}>
                <span className="flex items-center gap-2"><FileText /> Patient report (Urdu / English)</span> <ArrowRight />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <a href={pdfUrl(s.id, "en")} download>
                  <Download /> PDF (EN)
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={pdfUrl(s.id, "ur")} download>
                  <Download /> PDF (اردو)
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" /> Image passed the quality check</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
              <dt>Screened</dt>
              <dd className="text-foreground">{formatDateTime(s.created_at)}</dd>
              <dt>Continuous score</dt>
              <dd className="text-foreground tabular-nums">{s.continuous_score?.toFixed(3)}</dd>
              <dt>Decision rule</dt>
              <dd className="text-foreground">{s.decision_reason}</dd>
              <dt className="flex items-center gap-1"><Cpu className="size-3.5" /> Model</dt>
              <dd className="break-all text-foreground">{s.model_version}</dd>
              {s.inference_time_ms != null && (
                <>
                  <dt>Processing time</dt>
                  <dd className="text-foreground">{(s.inference_time_ms / 1000).toFixed(1)} s</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
