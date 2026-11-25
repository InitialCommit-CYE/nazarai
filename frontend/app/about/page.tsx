import { Ban, BrainCircuit, Database, Eye, Lock, Rocket, ShieldAlert, Target, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";

import { SafetyDisclaimer } from "@/components/clinical/notices";

export const metadata: Metadata = { title: "About & safety" };

const SECTIONS = [
  {
    icon: Target,
    title: "Intended use",
    items: [
      "Screening and triage support for adults with diabetes, operated by trained health workers, nurses or GPs.",
      "Sorts patients into rescreen-in-12-months, refer, or refer-urgently so specialists see those who need them.",
      "Every referral decision should be confirmed by an eye specialist. NazarAI does not diagnose or treat.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Safety design",
    items: [
      "Quality gate first: blurry, dark, overexposed or non-retina images are rejected and never graded.",
      "Referral threshold tuned for high sensitivity on validation data: a false referral costs one visit; a miss can cost sight.",
      "Scores just below moderate NPDR fall in a safety band and are referred as a precaution, never reported as normal.",
      "The language model only rewrites an existing result; the grade, referral and disclaimer are fixed texts.",
    ],
  },
  {
    icon: TriangleAlert,
    title: "Limitations",
    items: [
      "Trained on APTOS 2019 (India) and tested externally on IDRiD (India); not yet validated on Pakistani clinical data or local cameras.",
      "The referral cut-off is chosen on validation data only. Scores shift between cameras, so each new site or camera needs threshold calibration before use.",
      "Does not grade diabetic macular oedema or detect other eye diseases (glaucoma, cataract, vein occlusion).",
      "Image-quality checks are heuristics tuned on a small set of images; unusual cameras may be rejected or mis-assessed.",
      "Confidence is a heuristic (boundary margin × agreement between views), not a calibrated probability.",
      "Grad-CAM shows what influenced the model; it is coarse and is not evidence that a result is correct.",
    ],
  },
  {
    icon: Lock,
    title: "Privacy practices",
    items: [
      "Demo only: synthetic patient references, never names or real identifiers.",
      "Retinal images are uploaded to a private bucket through short-lived signed URLs and deleted right after analysis.",
      "Only screening metadata (grade, referral, quality, model version) is stored, in Supabase PostgreSQL with row-level security.",
      "Database access and all secrets stay on the server; the browser never holds privileged keys.",
    ],
  },
  {
    icon: Database,
    title: "Data sources",
    items: [
      "APTOS 2019 Blindness Detection (Aravind Eye Hospital, India): training and validation (stratified by grade).",
      "IDRiD (Porwal et al., CC BY 4.0): external test set and the bundled demo images.",
    ],
  },
  {
    icon: BrainCircuit,
    title: "AI model",
    items: [
      "EfficientNet-B3 (timm, ImageNet-pretrained) with one regression output for the 0–4 grade (ordinal regression).",
      "Shared preprocessing for training and inference: border crop, 384 px resize, Ben Graham enhancement, circular mask.",
      "Grade thresholds optimised for quadratic weighted kappa; served with ONNX Runtime on CPU with flip test-time augmentation.",
      "Patient reports written by Anthropic's Claude from the stored result, with a fixed-template fallback.",
    ],
  },
  {
    icon: Rocket,
    title: "Future development",
    items: [
      "Pilot with a Pakistani eye hospital to validate on local patients and cameras.",
      "Diabetic macular oedema grading and other referable eye diseases.",
      "Low-cost smartphone fundus adapters and an offline edge version for Basic Health Units.",
      "Clinician accounts, audit trails and integration with health-information systems.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">About & safety</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Built to support clinicians, not replace them</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          NazarAI is a prototype built for the Capital Youth Expo Hackathon 2026 (Healthcare track). It brings the proven
          idea of autonomous diabetic-retinopathy screening to the setting where it is most needed: Pakistani diabetes
          clinics without an eye specialist.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Users, t: "Operator", d: "Health worker, nurse or GP at a diabetes clinic or BHU" },
          { icon: Eye, t: "Patient", d: "Adult with diabetes; receives an Urdu or English report" },
          { icon: Ban, t: "Not for", d: "Diagnosis, treatment decisions, or children" },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-border bg-card p-5">
            <c.icon className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold">{c.t}</p>
            <p className="text-sm text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <s.icon className="size-5 text-primary" aria-hidden="true" /> {s.title}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">Medical disclaimer</h2>
      <SafetyDisclaimer className="mt-3 text-base" />
    </div>
  );
}
