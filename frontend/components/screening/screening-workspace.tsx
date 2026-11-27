"use client";

import { AlertCircle, ArrowRight, Check, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SafetyDisclaimer } from "@/components/clinical/notices";
import { PatientBanner } from "@/components/clinical/patient-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/site/logo";
import { ApiError, runScreening, uploadImage } from "@/lib/client/api";
import { saveSessionImages } from "@/lib/client/session-images";
import { publishScreenState } from "@/components/site/demo-guide";
import type { ImageSource, QualityIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ImagePicker } from "./image-picker";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { QualityFeedback } from "./quality-feedback";
import { SampleGallery, type SampleImage } from "./sample-gallery";
import { type Phase } from "./screening-progress";

interface Selection {
  file: File;
  source: ImageSource;
  previewUrl: string;
  label: string;
  sampleId: string | null;
}

export function ScreeningWorkspace({ initialPatient }: { initialPatient: PickedPatient | null }) {
  const router = useRouter();
  const [patient, setPatient] = useState<PickedPatient | null>(initialPatient);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<QualityIssue[] | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.previewUrl);
  }, [selection]);

  // Tell the guided demo where the visitor is in the flow.
  useEffect(() => publishScreenState(!!patient, !!selection), [patient, selection]);
  useEffect(() => () => publishScreenState(false, false), []);

  const busy = phase === "uploading" || phase === "analyzing" || phase === "done" || loadingSample;

  function select(file: File, source: ImageSource, sampleId: string | null = null, label?: string) {
    setSelection({ file, source, previewUrl: URL.createObjectURL(file), label: label ?? file.name, sampleId });
    setError(null);
    setRejected(null);
    setPhase("idle");
  }

  async function selectSample(s: SampleImage) {
    setLoadingSample(true);
    setError(null);
    try {
      const res = await fetch(`/demo/${s.file}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      select(new File([blob], `sample-${s.number ?? 0}.jpg`, { type: "image/jpeg" }), "sample", s.id, `Sample photo ${s.number ?? ""} (IDRiD, CC BY 4.0)`);
    } catch {
      setError("Could not load the sample image.");
    } finally {
      setLoadingSample(false);
    }
  }

  async function start() {
    if (!selection) return;
    if (!patient) {
      setError("Choose the patient this photo belongs to.");
      return;
    }
    setError(null);
    setRejected(null);
    setUploadPct(0);
    setPhase("uploading");
    try {
      const path = await uploadImage(selection.file, setUploadPct);
      setPhase("analyzing");
      const res = await runScreening(path, selection.source, patient.id);
      if (!res.screening.quality_ok) {
        setPhase("idle");
        setRejected(res.screening.quality_issues);
        return;
      }
      if (res.images) saveSessionImages(res.screening.id, res.images);
      setPhase("done");
      router.push(`/screenings/${res.screening.id}`);
    } catch (e) {
      setPhase("error");
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  const step = !patient ? 1 : !selection ? 2 : 3;
  const running = phase === "uploading" || phase === "analyzing" || phase === "done";

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Step 1: identify the patient first, so a photo can never land on the wrong record */}
          {patient ? (
            <PatientBanner
              patient={patient}
              actions={
                <Button variant="outline" size="sm" onClick={() => setPatient(null)} disabled={busy}>
                  <RefreshCcw /> Change patient
                </Button>
              }
            />
          ) : (
            <Card data-tour="patient">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">
                  <StepNumber n={1} /> Who are you screening?
                </CardTitle>
                <CardDescription>Search the clinic register by name or MR number, or register a new patient.</CardDescription>
              </CardHeader>
              <CardContent>
                <PatientPicker value={null} onChange={setPatient} disabled={busy} />
              </CardContent>
            </Card>
          )}

          {/* Step 2: the retina photo (locked until the patient is confirmed) */}
          <Card data-tour="photo" aria-disabled={!patient} className={cn("transition-opacity", !patient && "pointer-events-none opacity-40 select-none")}>
            <CardHeader>
              <CardTitle className="text-xl font-bold tracking-tight">
                <StepNumber n={2} /> Retina photo
              </CardTitle>
              <CardDescription>
                {patient ? `Upload or capture a colour fundus photo of ${patient.full_name.split(" ")[0]}’s eye.` : "Confirm the patient first."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImagePicker
                previewUrl={selection?.previewUrl ?? null}
                fileLabel={selection?.label ?? null}
                disabled={busy || !patient}
                onFile={(f, src) => select(f, src)}
                onError={setError}
                onClear={() => {
                  setSelection(null);
                  setRejected(null);
                  setPhase("idle");
                }}
              />
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink-muted">No camera here? Use a sample photo from a public dataset</h3>
                <SampleGallery selectedId={selection?.sampleId ?? null} disabled={busy || !patient} onSelect={selectSample} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 3: review and run. While it runs, this panel becomes the scan stage. */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section data-tour="run" className="rounded-[1.75rem] border border-white/[0.07] bg-surface p-5 sm:p-6">
            {running && selection ? (
              <ScanStage previewUrl={selection.previewUrl} phase={phase} />
            ) : (
              <>
                <h2 className="text-xl font-bold tracking-tight">
                  <StepNumber n={3} /> Check and run
                </h2>
                <ul className="mt-5 space-y-3 text-sm">
                  <CheckRow done={!!patient} label="Patient" value={patient ? `${patient.full_name} · MR ${patient.mrn}` : "Not chosen"} />
                  <CheckRow done={!!selection} label="Retina photo" value={selection ? selection.label : "Not added"} />
                </ul>
              </>
            )}
            <RunButton phase={phase} uploadPct={uploadPct} disabled={!selection || !patient || busy} onClick={start} />
            {!running && <p className="mt-3 text-center text-xs text-muted-foreground">Checks photo quality, grades it 0 to 4 and explains the result.</p>}
          </section>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Screening could not be completed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {rejected && <QualityFeedback issues={rejected} />}

          <SafetyDisclaimer showUrdu={false} />
        </div>
      </div>
    </div>
  );
}

/** The analysing phase has no server-side sub-steps, so the stage walks through them on a gentle clock. */
function useStageClock(active: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    const id = window.setInterval(() => setT(performance.now() - started), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return active ? t : 0;
}

type RowState = "wait" | "busy" | "done";

function ScanStage({ previewUrl, phase }: { previewUrl: string; phase: Phase }) {
  const t = useStageClock(phase === "analyzing");
  const done = phase === "done";
  const qualityDone = done || (phase === "analyzing" && t > 1800);
  const mapping = phase === "analyzing" && t > 4200;
  const rows: { label: string; state: RowState; value: string }[] = [
    { label: "Secure upload", state: phase === "uploading" ? "busy" : "done", value: phase === "uploading" ? "sending" : "done" },
    { label: "Photo quality", state: phase === "uploading" ? "wait" : qualityDone ? "done" : "busy", value: qualityDone ? "passed" : phase === "uploading" ? "–" : "checking" },
    { label: "Grade 0–4", state: done ? "done" : qualityDone ? "busy" : "wait", value: done ? "ready" : qualityDone ? "reading" : "–" },
    { label: "Where it looked", state: done ? "done" : mapping ? "busy" : "wait", value: done ? "ready" : mapping ? "mapping" : "–" },
  ];
  return (
    <div aria-live="polite">
      <div className="relative mx-auto aspect-square w-full max-w-[17rem]">
        <div className="aperture-ring absolute inset-0" />
        <div className="retina-glow absolute inset-[7%] overflow-hidden rounded-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL of the photo being screened */}
          <img src={previewUrl} alt="The retina photo being screened" className="size-full object-cover" />
          <div className="scan-line" aria-hidden="true" />
        </div>
      </div>
      <ul className="mt-5 space-y-2.5 text-[0.95rem]">
        {rows.map((r) => (
          <li key={r.label} className={cn("flex items-center justify-between gap-3", r.state === "wait" && "text-[#5f656d]")}>
            <span>{r.label}</span>
            <span className="flex items-center gap-2 text-sm">
              {r.state === "done" && <span className="size-2 rounded-full bg-routine" aria-hidden />}
              {r.state === "busy" && <span className="size-2 animate-pulse rounded-full bg-foreground" aria-hidden />}
              <span className={r.state === "busy" ? "text-foreground" : undefined}>{r.value}</span>
            </span>
          </li>
        ))}
      </ul>
      {phase === "analyzing" && t > 9000 && (
        <p className="mt-3 text-xs text-muted-foreground">The first request after a quiet period can take up to a minute while the ML server wakes up.</p>
      )}
    </div>
  );
}

/** "Run screening" stretches into its own progress bar: one continuous motion, no spinner. */
function RunButton({ phase, uploadPct, disabled, onClick }: { phase: Phase; uploadPct: number; disabled: boolean; onClick: () => void }) {
  const running = phase === "uploading" || phase === "analyzing" || phase === "done";
  const pct = phase === "uploading" ? 4 + uploadPct * 0.26 : phase === "analyzing" ? 92 : phase === "done" ? 100 : 0;
  const label =
    phase === "uploading" ? "Uploading securely" : phase === "analyzing" ? "Reading the retina" : phase === "done" ? "Opening the result" : phase === "error" ? "Try again" : "Run screening";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={running}
      className={cn(
        "relative mt-6 flex h-16 w-full items-center justify-center overflow-hidden rounded-full text-lg font-extrabold tracking-[-0.01em] transition-[background-color,box-shadow,color] duration-500 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
        running
          ? "bg-white/[0.07] text-foreground"
          : "bg-primary text-primary-foreground shadow-[0_0_0_6px_rgb(244_243_239/0.1)] hover:shadow-[0_0_0_8px_rgb(244_243_239/0.14)] disabled:bg-white/10 disabled:text-muted-foreground disabled:shadow-none",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{
          width: running ? `${pct}%` : "0%",
          opacity: running ? 1 : 0,
          transition: phase === "analyzing" ? "width 9s cubic-bezier(0.1, 0.6, 0.2, 1), opacity .3s" : "width .5s ease, opacity .3s",
        }}
      />
      <span className={cn("relative flex items-center gap-3", running && "text-white mix-blend-difference")}>
        {!running && <LogoMark className="size-6" />}
        {label}
        {!running && <ArrowRight className="size-5" aria-hidden />}
      </span>
    </button>
  );
}

const STEPS = ["Patient", "Retina photo", "Result"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="max-w-3xl">
      <ol className="flex justify-between text-sm" aria-label="Screening steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === current;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className={cn(n <= current ? "text-foreground" : "text-muted-foreground", active && "font-bold")}>
              {n} · {label}
            </li>
          );
        })}
      </ol>
      <div className="mt-2.5 h-[3px] rounded-full bg-white/[0.08]" aria-hidden>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-700" style={{ width: `${current === 1 ? 12 : current === 2 ? 50 : 86}%` }} />
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full border-2 border-white/20 align-[3px] text-sm font-bold">{n}</span>;
}

function CheckRow({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", done ? "bg-foreground text-background" : "border border-dashed border-muted-foreground/50")}>
        {done && <Check className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn("block truncate", done ? "font-medium" : "text-muted-foreground")}>{value}</span>
      </span>
    </li>
  );
}
