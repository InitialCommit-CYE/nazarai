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
      "Trained on APTOS 2019 (India) and EyePACS (US screening photos), tested externally on IDRiD (India); not yet validated on Pakistani clinical data or local cameras.",
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
      "APTOS 2019 Blindness Detection (Aravind Eye Hospital, India) and EyePACS / Kaggle DR Detection 2015 (resized copy): training and validation.",
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
      "Patient reports come from fixed Urdu / English templates filled from the stored result. An optional language model may reword the explanation paragraph only; it is not enabled in this deployment.",
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
        <p className="eyebrow text-primary">About & safety</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">Built to support clinicians, not replace them</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          NazarAI is a prototype built for the Capital Youth Expo Hackathon 2026 (Healthcare track). It brings the regulator-tested
          idea of AI diabetic-retinopathy screening to the setting where it is most needed: Pakistani diabetes
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

      <section id="privacy" className="mt-12 scroll-mt-24 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Privacy and data protection</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {[
            "Retina photos are uploaded to a private bucket, analysed, and deleted immediately. Only the screening result is kept.",
            "Patient records hold the minimum needed for follow-up: name, clinic reference, birth year, diabetes history and an optional phone number.",
            "Access is enforced in the database (Row Level Security): staff see only their own clinic; clinic admins manage staff but cannot open patient records; patients see only records they linked with a one-time code.",
            "Opening, changing or deleting a record is written to an append-only audit log that the clinic admin can review. The log never contains patient details.",
            "Data is stored with Supabase (PostgreSQL, encrypted at rest by the provider) and served over HTTPS. AI explanations receive only the model result, never names or contact details.",
            "This demo uses synthetic patients and public-dataset images only. It has not been assessed for compliance with any medical-data regulation and must not be used with real patient data without that review.",
          ].map((i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              {i}
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mt-12 text-xl font-semibold">Medical disclaimer</h2>
      <SafetyDisclaimer className="mt-3 text-base" />
    </div>
  );
}
