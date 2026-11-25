"use client";

import { AlertCircle, ArrowRight, ScanEye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SafetyDisclaimer } from "@/components/clinical/notices";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, runScreening, uploadImage } from "@/lib/client/api";
import { saveSessionImages } from "@/lib/client/session-images";
import type { ImageSource, QualityIssue } from "@/lib/types";

import { ImagePicker } from "./image-picker";
import { PatientForm, patientErrors, randomDemoCode, type PatientDraft } from "./patient-form";
import { QualityFeedback } from "./quality-feedback";
import { SampleGallery, type SampleImage } from "./sample-gallery";
import { ScreeningProgress, type Phase } from "./screening-progress";

interface Selection {
  file: File;
  source: ImageSource;
  previewUrl: string;
  label: string;
  sampleId: string | null;
}

export function ScreeningWorkspace() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientDraft>({ code: "", age: "", duration: "" });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<QualityIssue[] | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.previewUrl);
  }, [selection]);

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
      select(new File([blob], s.file, { type: "image/jpeg" }), "sample", s.id, `Sample: ${s.file} (IDRiD, CC BY 4.0)`);
    } catch {
      setError("Could not load the sample image.");
    } finally {
      setLoadingSample(false);
    }
  }

  async function start() {
    if (!selection) return;
    if (Object.keys(patientErrors(patient)).length) {
      setError("Please fix the patient details first.");
      return;
    }
    // Every screening gets a synthetic reference so the clinic queue stays readable.
    const code = patient.code || randomDemoCode();
    if (!patient.code) setPatient((p) => ({ ...p, code }));
    setError(null);
    setRejected(null);
    setUploadPct(0);
    setPhase("uploading");
    try {
      const path = await uploadImage(selection.file, setUploadPct);
      setPhase("analyzing");
      const res = await runScreening(path, selection.source, {
        demoPatientCode: code,
        age: patient.age ? Number(patient.age) : undefined,
        diabetesDurationYears: patient.duration ? Number(patient.duration) : undefined,
      });
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1 · Fundus photograph</CardTitle>
            <CardDescription>Upload or capture a colour photo of the retina, or try a bundled sample image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImagePicker
              previewUrl={selection?.previewUrl ?? null}
              fileLabel={selection?.label ?? null}
              disabled={busy}
              onFile={(f, src) => select(f, src)}
              onError={setError}
              onClear={() => {
                setSelection(null);
                setRejected(null);
                setPhase("idle");
              }}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">No image? Use a sample from a public dataset</h3>
              <SampleGallery selectedId={selection?.sampleId ?? null} disabled={busy} onSelect={selectSample} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2 · Patient (optional)</CardTitle>
            <CardDescription>Synthetic demo reference only.</CardDescription>
          </CardHeader>
          <CardContent>
            <PatientForm value={patient} onChange={setPatient} disabled={busy} />
          </CardContent>
        </Card>

        <Button size="lg" className="h-12 w-full text-base" disabled={!selection || busy} onClick={start}>
          <ScanEye /> {phase === "error" ? "Try again" : "Run screening"} <ArrowRight />
        </Button>

        <ScreeningProgress phase={phase === "error" ? "idle" : phase} uploadPct={uploadPct} />

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
  );
}
