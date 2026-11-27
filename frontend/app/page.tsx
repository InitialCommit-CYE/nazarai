import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DISCLAIMER } from "@/lib/clinical";
import retinaHeat from "@/public/landing/retina-heat.jpg";
import retina from "@/public/landing/retina.jpg";

/* The front door. Judges and clinics come here to try the product, so the first screen gets them into the app
   in one click; the short story underneath is for anyone who scrolls. Every number is sourced or measured:
   model figures come from ml/reports/metrics.json (model efficientnet_b3-384-202611251638); update both together.
   The retina images are a public IDRiD photo (CC BY 4.0) and the app's own Grad-CAM output for it. */

const STEPS = [
  { n: "01", title: "Quality gate.", body: "Blurry, dark or not a retina? It asks for a retake instead of guessing." },
  { n: "02", title: "Grade 0 to 4.", body: "The international diabetic retinopathy scale, as a continuous score." },
  { n: "03", title: "Where it looked.", body: "A heatmap a human can check before trusting the result." },
];

const GRADES = [
  { file: "grade0-no-dr.jpg", g: 0, label: "No DR", action: "Rescreen in 12 months", dot: "bg-routine" },
  { file: "grade1-mild.jpg", g: 1, label: "Mild", action: "Rescreen in 12 months", dot: "bg-routine" },
  { file: "grade2-moderate.jpg", g: 2, label: "Moderate", action: "Refer", dot: "bg-refer" },
  { file: "grade3-severe.jpg", g: 3, label: "Severe", action: "Refer urgently", dot: "bg-urgent" },
  { file: "grade4-proliferative.jpg", g: 4, label: "Proliferative", action: "Refer urgently", dot: "bg-urgent" },
] as const;

const OUTCOMES = [
  { label: "Rescreen in 12 months", dot: "bg-routine" },
  { label: "Refer to an eye specialist", dot: "bg-refer" },
  { label: "Refer urgently", dot: "bg-urgent" },
  { label: "Retake the photo", dot: "bg-[#9ba1a9]" },
];

const SAFETY = [
  ["Screening support, never a diagnosis", "Every result and report says so, in Urdu and English."],
  ["Unsure means refer", "A borderline score or low confidence never becomes “you’re fine”."],
  ["Bad photos are rejected", "The quality gate stops them before grading, with retake advice."],
  ["A human can check it", "The heatmap shows where the model looked; the specialist records the outcome."],
  ["No photo is kept", "Retina images are deleted right after grading. Demo patients are synthetic."],
  ["Tuned for sensitivity", "A missed eye costs more than an extra visit, so the threshold over-refers."],
];

function Retina({ heat, size, scan, priority }: { heat?: boolean; size: string; scan?: boolean; priority?: boolean }) {
  return (
    <div className={`retina-glow relative shrink-0 overflow-hidden rounded-full bg-black ${size}`}>
      <Image
        src={heat ? retinaHeat : retina}
        alt={heat ? "Retina photo with the AI attention heatmap over it" : "A colour retina (fundus) photo"}
        fill
        sizes="(min-width: 1024px) 420px, 70vw"
        className="object-cover"
        placeholder="blur"
        priority={priority}
      />
      {scan && <div className="scan-line" aria-hidden="true" />}
    </div>
  );
}

function GlassReading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass absolute flex flex-col gap-0.5 rounded-2xl px-4 py-2.5 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-bold">{children}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="-mt-[4.25rem] overflow-x-clip">
      {/* 1 · The front door */}
      <section className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-12 px-4 pt-28 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <div className="relative z-10">
          <h1 className="font-display text-[clamp(2.8rem,6vw,5.2rem)] leading-[0.95]">Every diabetic eye, screened at the clinic.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            A health worker takes one retina photo. NazarAI checks it, grades diabetic retinopathy and says who must see an eye
            specialist, in Urdu and English.
          </p>

          <div className="mt-10 flex max-w-2xl flex-col gap-3">
            <Link
              href="/auth/sign-in?demo=health-worker"
              className="group grid grid-cols-[1fr_auto] items-center gap-6 rounded-3xl bg-primary px-6 py-5 text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <span>
                <span className="block text-xl font-extrabold tracking-[-0.015em] sm:text-2xl">Start as the health worker</span>
                <span className="mt-1 block text-[0.95rem] text-[#3b3f45]">Pick a patient, add a retina photo, get the decision. About a minute.</span>
              </span>
              <span className="flex size-12 items-center justify-center rounded-full bg-[#060708] text-white transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
            <Link
              href="/auth/sign-in?demo=eye-specialist"
              className="glass group grid grid-cols-[1fr_auto] items-center gap-6 rounded-3xl px-6 py-5 transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <span>
                <span className="block text-lg font-bold sm:text-xl">Start as the eye specialist</span>
                <span className="mt-1 block text-[0.95rem] text-ink-muted">Open the referral worklist, urgent cases first, and record the outcome.</span>
              </span>
              <span className="flex size-12 items-center justify-center rounded-full border border-white/20 transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">One click, no sign-up. A short guide walks you through. Public dataset images, synthetic patients.</p>
          </div>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-[34rem] items-center justify-center">
          <div className="aperture-ring absolute inset-0" />
          <div className="aperture-ring absolute inset-[9%] border-white/10" />
          <Retina size="size-[64%]" scan priority />
          <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-6 text-sm whitespace-nowrap text-muted-foreground">
            <span>
              <strong className="text-lg text-foreground">99.4%</strong> referable eyes caught
            </span>
            <span>
              <strong className="text-lg text-foreground">516</strong> unseen test photos
            </span>
          </div>
        </div>
      </section>

      {/* 2 · Why, and how it works */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-white/[0.06]">
        <div id="why-it-matters" className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-32">
          <div>
            <p className="text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.18] font-bold tracking-[-0.025em] text-[#6b7178]">
              Pakistan has <span className="text-foreground">34.5 million</span> adults with diabetes. Each needs{" "}
              <span className="text-foreground">a retina check every year.</span> There are{" "}
              <span className="text-foreground">15 eye doctors</span> per million people.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              <a className="underline-offset-2 hover:underline" href="https://diabetesatlas.org/data-by-location/country/pakistan/" target="_blank" rel="noreferrer">
                IDF Diabetes Atlas, 11th ed. (2025)
              </a>{" "}
              ·{" "}
              <a className="underline-offset-2 hover:underline" href="https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan" target="_blank" rel="noreferrer">
                Express Tribune, Aug 2026
              </a>
            </p>

            <h2 className="mt-14 text-xl font-bold">So the photo is read at the clinic.</h2>
            <ol className="mt-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-5 border-t border-white/[0.07] py-5 last:border-b">
                  <span className="font-mono text-muted-foreground">{s.n}</span>
                  <p className="text-lg leading-snug">
                    <strong>{s.title}</strong> <span className="text-ink-muted">{s.body}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative mx-auto flex aspect-square w-full max-w-[36rem] items-center justify-center">
            <div className="aperture-ring absolute inset-0" />
            <Retina heat size="size-[76%]" />
            <GlassReading label="Photo quality" className="top-[14%] left-0">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-routine" aria-hidden /> Passed
              </span>
            </GlassReading>
            <GlassReading label="Grade" className="right-0 bottom-[16%]">
              <span className="font-mono">2.05</span> · Moderate
            </GlassReading>
          </div>
        </div>
      </section>

      {/* 2b · All five stages of the disease, as the model sees them */}
      <section aria-labelledby="grades-title" className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="grades-title" className="font-display max-w-2xl text-4xl sm:text-5xl">
              Five grades. Three actions.
            </h2>
            <p className="text-sm text-muted-foreground">IDRiD photos with their published reference grades · CC BY 4.0</p>
          </div>
          <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {GRADES.map((g) => (
              <li key={g.g} className="group">
                <div className="relative aspect-square">
                  <div className="aperture-ring absolute inset-0 transition-colors group-hover:border-white/20" />
                  <div className="absolute inset-[8%] overflow-hidden rounded-full bg-black shadow-[0_0_60px_2px_rgb(255_120_40/0.1)]">
                    <Image
                      src={`/demo/${g.file}`}
                      alt={`Retina photo, reference grade ${g.g} (${g.label})`}
                      fill
                      sizes="(min-width: 1024px) 220px, 45vw"
                      className="scale-[1.3] object-cover transition-transform duration-700 group-hover:scale-[1.38]"
                    />
                  </div>
                </div>
                <p className="font-display mt-6 text-2xl">
                  {g.g} <span className="text-lg font-semibold text-muted-foreground">{g.label}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <span className={`size-2.5 rounded-full ${g.dot}`} aria-hidden="true" />
                  {g.action}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 · The decision, the evidence, safety */}
      <section id="evidence" className="scroll-mt-24 px-3 sm:px-5">
        <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
          <p className="flex items-center gap-2.5 text-base font-semibold text-[#3b3f45]">
            <span className="size-2.5 rounded-full bg-refer ring-4 ring-refer/25" aria-hidden="true" />
            Then one clear instruction
          </p>
          <h2 className="mt-3 font-display text-[clamp(2.6rem,7vw,6rem)] leading-[0.9]">Refer to an eye specialist.</h2>
          <p dir="rtl" lang="ur" className="urdu mt-2 text-right text-2xl font-semibold sm:text-left sm:text-3xl">
            آنکھوں کے ماہر ڈاکٹر کو دکھائیں
          </p>
          <ul className="mt-7 flex flex-wrap gap-2 text-sm font-bold">
            {OUTCOMES.map((o) => (
              <li key={o.label} className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-4 py-2">
                <span className={`size-2 rounded-full ${o.dot}`} aria-hidden="true" />
                {o.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-1 py-20 sm:px-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-display text-[clamp(4rem,10vw,7.5rem)] leading-[0.9]">99.4%</p>
            <p className="mt-4 text-xl leading-relaxed text-ink-muted">
              of eyes that needed a specialist were caught (321 of 323) on 516 photos from IDRiD, an Indian dataset the model never
              saw. It over-refers on purpose: an extra visit costs less than an eye.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Specificity 61.7%, AUC 0.984 on the same test. Reference point, not head-to-head: IDx-DR reported 87% sensitivity in
              its trial.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            <Link
              href="/auth/sign-in?demo=health-worker"
              className="rounded-full bg-primary px-7 py-4 text-lg font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Start as the health worker
            </Link>
            <Link href="/performance" className="glass rounded-full px-6 py-3 text-center font-semibold hover:bg-white/10">
              Model performance
            </Link>
          </div>
        </div>
      </section>

      <section id="safety" className="scroll-mt-24 border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl">Built to fail safe.</h2>
            <p className="mt-4 max-w-sm text-ink-muted">{DISCLAIMER.en}</p>
          </div>
          <dl className="grid gap-x-12 sm:grid-cols-2">
            {SAFETY.map(([t, d]) => (
              <div key={t} className="border-t border-white/[0.07] py-5">
                <dt className="text-lg font-bold">{t}</dt>
                <dd className="mt-1 text-ink-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
