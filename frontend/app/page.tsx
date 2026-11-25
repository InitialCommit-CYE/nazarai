import {
  ArrowRight,
  BrainCircuit,
  Building2,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Hospital,
  Languages,
  Layers,
  ListOrdered,
  ScanEye,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATS = [
  {
    value: "34.5M",
    label: "adults in Pakistan live with diabetes (2024), projected to reach 70.2M by 2050",
    source: "IDF Diabetes Atlas, 11th ed.",
    href: "https://diabetesatlas.org/data-by-location/country/pakistan",
  },
  {
    value: "#1",
    label: "highest adult diabetes prevalence in the world: 31.4% of adults aged 20–79 (age-standardised)",
    source: "IDF Diabetes Atlas, 11th ed. (2025)",
    href: "https://diabetesatlas.org/data-by-location/country/pakistan",
  },
  {
    value: "15",
    label: "ophthalmologists per million people: far too few to examine every diabetic retina each year",
    source: "Express Tribune, Aug 2026",
    href: "https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan",
  },
];

const STEPS = [
  { icon: Camera, title: "Capture", text: "A health worker photographs the retina with a fundus camera, or picks a sample image." },
  { icon: ShieldCheck, title: "Quality gate", text: "Blurry, dark, overexposed or non-retina photos are rejected with retake advice, never graded." },
  { icon: BrainCircuit, title: "AI grading", text: "An EfficientNet ordinal model estimates the DR grade (0–4) with a sensitivity-first referral rule." },
  { icon: Layers, title: "Explain", text: "A Grad-CAM heatmap shows which retinal regions drove the score, for a human to check." },
  { icon: Languages, title: "Report & refer", text: "Plain Urdu or English report, PDF referral slip, and a clinic queue sorted by urgency." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-7">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs">
              <Eye className="size-3.5" /> Nazar (نظر): sight, vision
            </Badge>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Diabetic eye screening in seconds, <span className="text-primary">so specialists see who needs them.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Diabetic retinopathy causes no symptoms until sight is already damaged, yet it is preventable if caught early.
              NazarAI checks a retina photo, estimates the disease grade, explains its reasoning and writes the referral
              in Urdu or English.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/screen">
                  <ScanEye /> Start screening <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Screening and triage support, not a diagnosis.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
            <div className="absolute inset-6 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative rounded-[2rem] border border-border bg-card p-5 shadow-xl shadow-primary/5">
              <div className="relative aspect-square overflow-hidden rounded-full bg-black ring-1 ring-border">
                <Image
                  src="/demo/grade3-severe.jpg"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 420px, 80vw"
                  className="scale-[1.32] object-cover"
                />
                <div className="absolute inset-0 animate-[spin_9s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,oklch(0.75_0.12_190/0.35)_40deg,transparent_70deg)] motion-reduce:animate-none" />
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-2 text-sm">
                {["Quality check", "DR grade 0–4", "Grad-CAM heatmap", "Urdu / English report"].map((t) => (
                  <li key={t} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-medium">
                    <CheckCircle2 className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">Illustration · IDRiD image, CC BY 4.0</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="problem">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">The problem</p>
          <h2 id="problem" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pakistan cannot screen its diabetics with specialists alone
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every person with diabetes needs a retina check about once a year. In Pakistan, diabetic patients are not
            routinely screened, and the specialists who could grade the photos are scarce.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STATS.map((s) => (
            <figure key={s.value} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="text-5xl font-semibold tracking-tight text-primary">{s.value}</div>
              <figcaption className="mt-3 flex-1 text-base leading-relaxed">{s.label}</figcaption>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Source: {s.source}
              </a>
            </figure>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-secondary/50 p-6 text-sm leading-relaxed">
          <strong className="font-semibold">Scale (our own estimate):</strong> about 27% of people with diabetes have some
          form of DR worldwide (meta-analysis cited in{" "}
          <a className="underline underline-offset-2" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9940560" target="_blank" rel="noreferrer">
            PMC9940560
          </a>
          ). Applied to 34.5M Pakistani adults with diabetes, that suggests roughly <strong>9 million people</strong> may
          have some DR, most of whom have never had a retinal exam. This is a rough estimate, not a measured figure.
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-muted/40" aria-labelledby="how">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">How it works</p>
          <h2 id="how" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From photo to referral in one flow</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { g: "Grade 0–1", a: "No referable DR: rescreen in 12 months", c: "border-routine/30 bg-routine-soft" },
              { g: "Grade 2", a: "Refer to an eye specialist", c: "border-refer/40 bg-refer-soft" },
              { g: "Grade 3–4", a: "Refer URGENTLY: risk to sight", c: "border-urgent/30 bg-urgent-soft" },
            ].map((r) => (
              <div key={r.g} className={`rounded-xl border px-4 py-3 text-sm ${r.c}`}>
                <span className="font-semibold">{r.g}</span> → {r.a}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence + technology */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2" aria-labelledby="evidence">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Why AI screening</p>
          <h2 id="evidence" className="mt-2 text-3xl font-semibold tracking-tight">Autonomous DR screening is proven</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            IDx-DR (now LumineticsCore) became the first FDA-authorised autonomous AI diagnostic system in April 2018,
            used in primary care without an eye specialist reading the images. In its 900-patient trial it reached{" "}
            <strong className="text-foreground">87% sensitivity and 90% specificity</strong> for more-than-mild DR.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            That is our benchmark. NazarAI reports its own validation and external-test results next to it, honestly,
            on the{" "}
            <Link href="/performance" className="font-medium text-primary underline-offset-2 hover:underline">
              model performance page
            </Link>
            .
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Sources:{" "}
            <a className="underline" href="https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f" target="_blank" rel="noreferrer">AAO</a>,{" "}
            <a className="underline" href="https://chiefhealthcareexecutive.com/view/the-numbers-behind-the-first-fdaapproved-autonomous-ai-diagnostic-system" target="_blank" rel="noreferrer">Chief Healthcare Executive</a>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: ShieldCheck, t: "Sensitivity first", d: "Referral threshold tuned for ≥ 87% sensitivity; borderline cases are referred, never told they are fine." },
            { icon: ListOrdered, t: "Ordinal grading", d: "One regression output with validation-optimised thresholds (Quadratic Weighted Kappa)." },
            { icon: Eye, t: "External validation", d: "Tested on IDRiD (India), never used for training or threshold tuning." },
            { icon: FileText, t: "Grounded reports", d: "Claude only explains the model's result; grade and referral text are fixed templates." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section className="border-t border-border bg-gradient-to-b from-secondary/60 to-background" aria-labelledby="impact">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Real-world impact</p>
          <h2 id="impact" className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
            One camera per clinic. Specialists only see referrals.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Building2, t: "Diabetes clinics & BHUs", d: "Nurses and GPs screen during routine diabetes visits, without an eye specialist on site." },
              { icon: Stethoscope, t: "Eye hospitals", d: "Ophthalmologists receive a pre-sorted queue: urgent cases first, routine cases rescreened next year." },
              { icon: Hospital, t: "Health programmes", d: "Urdu reports and PDF slips fit existing referral pathways; the system scales with software, not specialists." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-card p-6">
                <c.icon className="size-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-teal-deep p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h3 className="text-2xl font-semibold">Try the full clinic workflow</h3>
              <p className="mt-2 text-white/80">
                Sign in to the demo clinic as a health worker, eye specialist, admin or patient. Synthetic records and public-dataset images only.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-11 shrink-0 px-5 text-base">
              <Link href="/auth/sign-in?next=/screen">
                Open the demo clinic <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
