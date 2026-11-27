import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ArrowLink, QuietLink } from "@/components/ui/arrow-link";
import { DISCLAIMER } from "@/lib/clinical";
import { demoHref } from "@/lib/demo";
import retinaHeat from "@/public/landing/retina-heat.jpg";
import retina from "@/public/landing/retina.jpg";

/* The front door. Judges and clinics come here to try the product, so the first screen gets them into the app
   in one click; the short story underneath is for anyone who scrolls. Every number is sourced or measured:
   model figures come from ml/reports/metrics.json (model efficientnet_b3-384-202611251638); update both together.
   The retina images are a public IDRiD photo (CC BY 4.0) and the app's own Grad-CAM output for it. */

const STEPS = [
  { n: "01", title: "Quality gate", body: "Blurry, dark or not a retina? It asks for a retake instead of guessing." },
  { n: "02", title: "Grade 0 to 4", body: "The international diabetic retinopathy scale, as a continuous score." },
  { n: "03", title: "Where it looked", body: "A heatmap a human can check before trusting the result." },
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
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-black ${size}`}>
      <Image
        src={heat ? retinaHeat : retina}
        alt={heat ? "Retina photo with the AI attention heatmap over it" : "A colour retina (fundus) photo"}
        fill
        sizes="(min-width: 1024px) 420px, 70vw"
        className="object-cover"
        placeholder="blur"
        priority={priority}
      />
      {scan && <div className="scan-line scan-once" aria-hidden="true" />}
    </div>
  );
}

function Reading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute flex flex-col gap-0.5 rounded-2xl border border-white/10 bg-[#121418] px-4 py-3 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[0.9375rem] font-medium">{children}</span>
    </div>
  );
}

function SectionIntro({ label, title, muted, children, centered }: { label: string; title: string; muted?: string; children?: React.ReactNode; centered?: boolean }) {
  return (
    <div className={centered ? "mx-auto max-w-4xl text-center" : "max-w-3xl"}>
      <p className="eyebrow">{label}</p>
      <h2 className="font-display mt-5 text-[clamp(2.25rem,4vw,3.5rem)] leading-[1.1] text-balance">
        {title}
        {muted && (
          <>
            <br />
            <span className="text-[#6b7178]">{muted}</span>
          </>
        )}
      </h2>
      {children && <div className={`mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-ink-muted ${centered ? "mx-auto" : ""}`}>{children}</div>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="-mt-[4.75rem] overflow-x-clip">
      {/* 1 · The front door */}
      <section className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-12 px-5 pt-32 pb-28 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-28">
        <div className="relative z-10 max-w-[46rem]">
          <p className="flex items-center gap-3 text-[0.8125rem] text-ink-muted">
            <span className="size-2 rounded-full border-2 border-foreground" aria-hidden />
            Diabetic eye screening for Pakistan’s clinics
          </p>
          <h1 className="font-display mt-6 text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.04] tracking-[-0.045em]">
            Every diabetic eye,
            <br />
            screened at the clinic
          </h1>
          <p className="mt-7 max-w-[27.5rem] text-[1.0625rem] leading-[1.7] text-ink-muted">
            A health worker takes one retina photo. NazarAI checks it, grades diabetic retinopathy and says who must see an eye
            specialist, in Urdu and English.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <ArrowLink href={demoHref("health-worker")} plain>Try it as the health worker</ArrowLink>
            <QuietLink href={demoHref("eye-specialist")} plain>Or as the eye specialist</QuietLink>
          </div>
          <p className="mt-5 max-w-[24rem] text-xs leading-relaxed text-muted-foreground">
            One click, no sign-up. A short guide walks you through. Public dataset images, synthetic patients.
          </p>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-[32rem] items-center justify-center">
          <div className="aperture-ring absolute inset-0" />
          <div className="aperture-ring absolute inset-[9%] border-white/10" />
          <Retina size="size-[64%]" scan priority />
        </div>

        <a href="#how-it-works" className="absolute bottom-8 left-5 flex min-h-11 items-center gap-3 text-xs text-ink-muted hover:text-foreground sm:left-8">
          <ArrowDown className="size-4" strokeWidth={1.5} aria-hidden /> How a screening works
        </a>
        <Link href="/performance" className="absolute right-5 bottom-8 hidden min-h-11 items-center gap-3 text-xs text-ink-muted hover:text-foreground sm:right-8 sm:flex">
          99.4% of referable eyes caught on 516 unseen photos <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </section>

      {/* 2 · Why, and how it works */}
      <section id="how-it-works" className="scroll-mt-28 border-t border-white/[0.06]">
        <div id="why-it-matters" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-28">
          <SectionIntro label="Why it matters" title="34.5 million adults in Pakistan have diabetes." muted="There are 15 eye doctors per million people." centered>
            <p>
              Each of them needs a retina check every year. Diabetic retinopathy causes no symptoms until sight is lost, and it is
              treatable if caught early.
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
          </SectionIntro>

          <div className="mt-24 grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-3xl tracking-[-0.03em] sm:text-4xl">
                So the photo is read
                <br />
                <span className="text-[#6b7178]">at the clinic</span>
              </h3>
              <ol className="mt-10">
                {STEPS.map((s) => (
                  <li key={s.n} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-white/[0.07] py-6 last:border-b">
                    <span className="pt-1 font-mono text-xs text-muted-foreground">{s.n}</span>
                    <div>
                      <p className="text-xl font-medium tracking-[-0.02em]">{s.title}</p>
                      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="relative mx-auto flex aspect-square w-full max-w-[34rem] items-center justify-center">
              <div className="aperture-ring absolute inset-0" />
              <Retina heat size="size-[76%]" />
              <Reading label="Photo quality" className="top-[14%] left-0">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-routine" aria-hidden /> Passed
                </span>
              </Reading>
              <Reading label="Grade" className="right-0 bottom-[16%]">
                <span className="font-mono">2.05</span> · Moderate
              </Reading>
            </div>
          </div>
        </div>
      </section>

      {/* 2b · All five stages of the disease, as the model sees them */}
      <section aria-labelledby="grades-title" className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="grades-title" className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-[1.1]">
              Five grades
              <br />
              <span className="text-[#6b7178]">Three actions</span>
            </h2>
            <p className="text-xs text-muted-foreground">IDRiD photos with their published reference grades · CC BY 4.0</p>
          </div>
          <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {GRADES.map((g) => (
              <li key={g.g}>
                <div className="relative aspect-square">
                  <div className="aperture-ring absolute inset-0" />
                  <div className="absolute inset-[8%] overflow-hidden rounded-full bg-black">
                    <Image src={`/demo/${g.file}`} alt={`Retina photo, reference grade ${g.g} (${g.label})`} fill sizes="(min-width: 1024px) 220px, 45vw" className="scale-[1.3] object-cover" />
                  </div>
                </div>
                <p className="mt-6 text-lg font-medium tracking-[-0.01em]">
                  {g.g} <span className="text-muted-foreground">{g.label}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-[0.8125rem] text-ink-muted">
                  <span className={`size-1.5 rounded-full ${g.dot}`} aria-hidden="true" />
                  {g.action}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 · The decision, the evidence */}
      <section id="evidence" className="scroll-mt-28 px-3 sm:px-5">
        <div className="mx-auto max-w-[88rem] rounded-[28px] bg-[#d6d1c6] px-6 py-12 text-[#14110d] sm:px-12 sm:py-16">
          <p className="flex items-center gap-3 text-[0.8125rem] text-[#4a4339]">
            <span className="size-2 rounded-full bg-refer ring-[1.5px] ring-black/25" aria-hidden="true" />
            Then one clear instruction
          </p>
          <h2 className="font-display mt-5 text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[1] tracking-[-0.045em]">Refer to an eye specialist</h2>
          <p dir="rtl" lang="ur" className="urdu mt-3 text-start text-2xl sm:text-3xl">
            آنکھوں کے ماہر ڈاکٹر کو دکھائیں
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-black/[0.12] pt-6 text-sm text-[#4a4339]">
            {OUTCOMES.map((o) => (
              <li key={o.label} className="flex items-center gap-2.5">
                <span className={`size-2 rounded-full ring-[1.5px] ring-black/25 ${o.dot}`} aria-hidden="true" />
                {o.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-2 py-24 sm:px-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Evidence, openly shared</p>
            <p className="font-display mt-6 text-[clamp(4.5rem,10vw,7rem)] leading-none tracking-[-0.06em] tabular-nums">
              99.4<span className="text-[0.5em] tracking-[-0.03em]">%</span>
            </p>
            <p className="mt-6 text-[1.0625rem] leading-[1.7] text-ink-muted">
              of eyes that needed a specialist were caught (321 of 323) on 516 photos from IDRiD, an Indian dataset the model never
              saw. It over-refers on purpose: an extra visit costs less than an eye.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Specificity 61.7%, AUC 0.984 on the same test. Reference point, not head-to-head: IDx-DR reported 87% sensitivity in
              its trial.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <ArrowLink href={demoHref("health-worker")} plain>Try it as the health worker</ArrowLink>
            <QuietLink href="/performance">See the full results</QuietLink>
          </div>
        </div>
      </section>

      {/* 4 · Safety */}
      <section id="safety" className="scroll-mt-28 border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Safety</p>
            <h2 className="font-display mt-5 text-4xl leading-[1.1] sm:text-5xl">
              Built to
              <br />
              <span className="text-[#6b7178]">fail safe</span>
            </h2>
            <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">{DISCLAIMER.en}</p>
          </div>
          <dl className="grid gap-x-12 sm:grid-cols-2">
            {SAFETY.map(([t, d]) => (
              <div key={t} className="border-t border-white/[0.07] py-6">
                <dt className="text-lg font-medium tracking-[-0.01em]">{t}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
