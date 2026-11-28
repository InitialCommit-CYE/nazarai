"use client";

import { AlertCircle, Check, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SafetyDisclaimer } from "@/components/clinical/notices";
import { PatientBanner } from "@/components/clinical/patient-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowChip, arrowPillClasses } from "@/components/ui/arrow-link";
import { ApiError, runScreening, uploadImage } from "@/lib/client/api";
import { saveSampleReference, type SampleReference } from "@/lib/client/sample-reference";
import { primeScreening } from "@/lib/client/screening-cache";
import { saveSessionImages } from "@/lib/client/session-images";
import { publishScreenState } from "@/components/site/demo-guide";
import type { ImageSource, QualityIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ImagePicker } from "./image-picker";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { QualityFeedback } from "./quality-feedback";
import { SampleGallery, sampleNumberOf, type SampleImage } from "./sample-gallery";
import { type Phase } from "./screening-progress";

interface Selection {
  file: File;
  source: ImageSource;
  previewUrl: string;
  label: string;
  sampleId: string | null;
  /** For a bundled sample: its gallery number and the dataset's expert grade, shown on the result. */
  reference: SampleReference | null;
}

/** The one-click sample case: a moderate case that shows the referral flow end to end. */
const SAMPLE_CASE: SampleImage = { id: "grade2-moderate", file: "grade2-moderate.jpg", reference_grade: 2, expected_quality_ok: true };

export function ScreeningWorkspace({ initialPatient, sampleCase = null }: { initialPatient: PickedPatient | null; sampleCase?: PickedPatient | null }) {
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

  function select(file: File, source: ImageSource, sampleId: string | null = null, label?: string, reference: SampleReference | null = null): Selection {
    const next = { file, source, previewUrl: URL.createObjectURL(file), label: label ?? file.name, sampleId, reference };
    setSelection(next);
    setError(null);
    setRejected(null);
    setPhase("idle");
    return next;
  }

  async function selectSample(s: SampleImage): Promise<Selection | null> {
    setLoadingSample(true);
    setError(null);
    try {
      const res = await fetch(`/demo/${s.file}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const number = s.number ?? sampleNumberOf(s.id);
      return select(new File([blob], `sample-${number}.jpg`, { type: "image/jpeg" }), "sample", s.id, `Sample photo ${number} (IDRiD, CC BY 4.0)`, {
        number,
        grade: s.reference_grade,
      });
    } catch {
      setError("Could not load the sample image.");
      return null;
    } finally {
      setLoadingSample(false);
    }
  }

  /** One click for a first-time visitor: the demo patient, a sample photo, and run. */
  async function runSampleCase() {
    if (!sampleCase) return;
    setPatient(sampleCase);
    const sel = await selectSample(SAMPLE_CASE);
    if (sel) await start(sel, sampleCase);
  }

  // start() normally reads the current choices; the sample case passes its own before state has updated.
  const selectionState = selection;
  const patientState = patient;
  async function start(selection: Selection | null = selectionState, patient: PickedPatient | null = patientState) {
    if (!selection) return;
    if (!patient) {
      setError("Choose the patient this photo belongs to.");
      return;
    }
    setError(null);
    setRejected(null);
    setUploadPct(0);
    // A sample photo is already on the server, so it skips the upload and goes straight to the model.
    const sampleId = selection.source === "sample" ? selection.sampleId : null;
    setPhase(sampleId ? "analyzing" : "uploading");
    try {
      const image = sampleId ? { sampleId } : { uploadPath: await uploadImage(selection.file, setUploadPct) };
      setPhase("analyzing");
      const res = await runScreening(image, selection.source, patient.id);
      if (!res.screening.quality_ok) {
        setPhase("idle");
        setRejected(res.screening.quality_issues);
        return;
      }
      if (res.images) saveSessionImages(res.screening.id, res.images);
      if (selection.reference) saveSampleReference(res.screening.id, selection.reference);
      primeScreening(res.screening);
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
      {sampleCase && !running && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#121418] px-5 py-4">
          <p className="max-w-xl text-[0.9375rem] text-ink-muted">
            <span className="font-medium text-foreground">New here?</span> Run a ready-made case in one click: {sampleCase.full_name} with
            Sample {sampleNumberOf(SAMPLE_CASE.id)} from the public IDRiD dataset.
          </p>
          <button type="button" onClick={runSampleCase} disabled={busy} className={arrowPillClasses("light", "min-h-11 gap-3 ps-5 pe-1 text-sm whitespace-nowrap")}>
            <span>Try a sample case</span>
            <ArrowChip />
          </button>
        </div>
      )}
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
                <CardTitle className="text-xl font-medium tracking-tight">
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
              <CardTitle className="text-xl font-medium tracking-tight">
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
          <section data-tour="run" className="rounded-[20px] border border-white/[0.07] bg-surface p-5 sm:p-6">
            {running && selection ? (
              <ScanStage previewUrl={selection.previewUrl} phase={phase} sample={selection.source === "sample"} />
            ) : (
              <>
                <h2 className="text-xl font-medium tracking-tight">
                  <StepNumber n={3} /> Check and run
                </h2>
                <ul className="mt-5 space-y-3 text-sm">
                  <CheckRow done={!!patient} label="Patient" value={patient ? `${patient.full_name} · MR ${patient.mrn}` : "Not chosen"} />
                  <CheckRow done={!!selection} label="Retina photo" value={selection ? selection.label : "Not added"} />
                </ul>
              </>
            )}
            <RunButton phase={phase} uploadPct={uploadPct} disabled={!selection || !patient || busy} onClick={() => start()} />
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

function ScanStage({ previewUrl, phase, sample }: { previewUrl: string; phase: Phase; sample: boolean }) {
  const t = useStageClock(phase === "analyzing");
  const done = phase === "done";
  const qualityDone = done || (phase === "analyzing" && t > 1800);
  const mapping = phase === "analyzing" && t > 4200;
  const rows: { label: string; state: RowState; value: string }[] = [
    sample
      ? { label: "Sample photo", state: "done", value: "ready" }
      : { label: "Secure upload", state: phase === "uploading" ? "busy" : "done", value: phase === "uploading" ? "sending" : "done" },
    { label: "Photo quality", state: phase === "uploading" ? "wait" : qualityDone ? "done" : "busy", value: qualityDone ? "passed" : phase === "uploading" ? "–" : "checking" },
    { label: "Grade 0–4", state: done ? "done" : qualityDone ? "busy" : "wait", value: done ? "ready" : qualityDone ? "reading" : "–" },
    { label: "Where it looked", state: done ? "done" : mapping ? "busy" : "wait", value: done ? "ready" : mapping ? "mapping" : "–" },
  ];
  return (
    <div aria-live="polite">
      <div className="relative mx-auto aspect-square w-full max-w-[17rem]">
        <div className="aperture-ring absolute inset-0" />
        <div className="absolute inset-[7%] overflow-hidden rounded-full bg-black">
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

/** "Run screening" stretches into its own progress bar: one continuous motion, no spinner. The fill moves with transform. */
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
        "group/arrow press relative mt-6 flex h-14 w-full items-center overflow-hidden rounded-full border text-base font-medium transition-[background-color,color,border-color,box-shadow,transform,font-weight] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
        running
          ? "justify-center border-transparent bg-white/[0.07] text-foreground"
          : "liquid-light justify-between border-white/70 ps-6 pe-1.5 text-primary-foreground hover:font-semibold disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left bg-primary"
        style={{
          transform: `scaleX(${running ? pct / 100 : 0})`,
          opacity: running ? 1 : 0,
          transition: phase === "analyzing" ? "transform 9s cubic-bezier(0.1, 0.6, 0.2, 1), opacity .3s" : "transform .5s cubic-bezier(0.22, 1, 0.36, 1), opacity .3s",
        }}
      />
      <span className={cn("relative", running && "text-white mix-blend-difference")}>{label}</span>
      {!running && (
        <span className={cn("relative", disabled && "opacity-40")}>
          <ArrowChip />
        </span>
      )}
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
            <li key={label} aria-current={active ? "step" : undefined} className={cn(n <= current ? "text-foreground" : "text-muted-foreground", active && "font-medium")}>
              {n} · {label}
            </li>
          );
        })}
      </ol>
      <div className="mt-2.5 h-[3px] rounded-full bg-white/[0.08]" aria-hidden>
        <div className="h-full origin-left rounded-full bg-foreground transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `scaleX(${current === 1 ? 0.12 : current === 2 ? 0.5 : 0.86})` }} />
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full border-2 border-white/20 align-[3px] text-sm font-medium">{n}</span>;
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
