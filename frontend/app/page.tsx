import { ArrowRight, ArrowUpRight, ScanEye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/clinical";

/* Every number on this page is sourced. Model figures come from ml/reports/metrics.json
   (model efficientnet_b3-384-202611251638); update both together. */

const STATS = [
  {
    value: "31.4%",
    label: "of adults in Pakistan live with diabetes: the highest rate of any country.",
    source: "IDF Diabetes Atlas, 11th ed. (2025)",
    href: "https://diabetesatlas.org/data-by-location/country/pakistan",
  },
  {
    value: "34.5M",
    label: "Pakistani adults with diabetes in 2024, heading for 70.2 million by 2050.",
    source: "IDF Diabetes Atlas, 11th ed. (2025)",
    href: "https://diabetesatlas.org/data-by-location/country/pakistan",
  },
  {
    value: "15",
    label: "ophthalmologists per million people. Every diabetic eye should be checked once a year.",
    source: "Express Tribune, Aug 2026",
    href: "https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan",
  },
];

const BEFORE = [
  "The patient is told to see an eye specialist, often at a hospital in another city.",
  "There are no symptoms, so the visit is easy to postpone.",
  "Damage is often found only when sight is already failing, and lost sight rarely returns.",
];
const AFTER = [
  "A health worker photographs the retina at the diabetes clinic, during the routine visit.",
  "NazarAI checks the photo, grades it and shows where it looked, in seconds.",
  "Only patients who need a specialist are referred, urgent cases first, with an Urdu report.",
];

const STEPS = [
  { n: "01", t: "Capture", d: "Fundus photo taken by a trained health worker. Or a bundled sample image." },
  { n: "02", t: "Quality gate", d: "Blurry, dark or non-retina photos are rejected with retake advice. Never graded." },
  { n: "03", t: "Grade", d: "EfficientNet-B3 estimates DR grade 0–4. Borderline scores are referred." },
  { n: "04", t: "Explain", d: "A Grad-CAM heatmap shows the regions that drove the score, for a human to check." },
  { n: "05", t: "Refer", d: "Urdu or English report, PDF referral slip, and a queue sorted by urgency." },
];

const GRADES = [
  { file: "grade0-no-dr.jpg", g: 0, label: "No DR", action: "Rescreen in 12 months", tone: "routine" },
  { file: "grade1-mild.jpg", g: 1, label: "Mild", action: "Rescreen in 12 months", tone: "routine" },
  { file: "grade2-moderate.jpg", g: 2, label: "Moderate", action: "Refer", tone: "refer" },
  { file: "grade3-severe.jpg", g: 3, label: "Severe", action: "Refer urgently", tone: "urgent" },
  { file: "grade4-proliferative.jpg", g: 4, label: "Proliferative", action: "Refer urgently", tone: "urgent" },
] as const;

const TONE = {
  routine: "bg-routine",
  refer: "bg-refer",
  urgent: "bg-urgent",
} as const;

const RESULTS = [
  { metric: "Sensitivity", ours: "99.4%", detail: "321 of 323 referable eyes caught", bench: "87%" },
  { metric: "Specificity", ours: "61.7%", detail: "119 of 193 non-referable eyes cleared", bench: "90%" },
  { metric: "AUC-ROC", ours: "0.984", detail: "ranking of referable vs not", bench: "not reported" },
];

const SETTINGS = [
  {
    t: "Diabetes clinics and BHUs",
    d: "Where diabetics already come every few months. A health worker screens during the routine visit, without an eye specialist on site.",
  },
  {
    t: "Eye-hospital outreach",
    d: "Screening camps and referral desks get a queue already sorted by urgency, so specialists spend their time on treatment.",
  },
  {
    t: "Public health programmes",
    d: "Software scales with cameras, not specialists: one fundus camera per clinic, results in Urdu, referrals on paper or online.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero: the problem in one sentence, the fix in the next */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div>
            <p className="eyebrow text-signal">Diabetic retinopathy screening · Pakistan</p>
            <h1 className="font-display mt-6 text-4xl leading-[1.05] text-balance sm:text-5xl lg:text-[4.1rem]">
              Diabetes takes sight without a single symptom.{" "}
              <span className="text-signal">In Pakistan, diabetic eyes are not routinely checked.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
              Diabetic retinopathy has no symptoms until sight is already damaged, yet it is treatable when caught early.
              NazarAI reads a retina photo at the clinic the patient already visits, and sends only those who need an eye
              specialist.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 bg-ink-foreground px-6 text-base text-ink hover:bg-white">
                <Link href="/auth/sign-in?demo=health-worker">
                  <ScanEye /> Try it as a health worker
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 px-5 text-base text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
              >
                <Link href="#how-it-works">
                  How it works <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              One click, no sign-up · synthetic patients · screening support, not a diagnosis
            </p>
          </div>

          <figure className="relative mx-auto w-full max-w-[26rem]" aria-label="Sample retina photo with screening read-out">
            <div className="relative aspect-square">
              <div className="absolute inset-0 rounded-full ring-1 ring-white/15" />
              <div className="absolute inset-[6%] overflow-hidden rounded-full bg-black">
                <Image
                  src="/demo/grade3-severe.jpg"
                  alt="Retina photograph from the IDRiD dataset, reference grade 3 (severe)"
                  fill
                  priority
                  sizes="(min-width: 1024px) 400px, 80vw"
                  className="scale-[1.3] object-cover"
                />
              </div>
              {/* instrument crosshair */}
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute top-1/2 left-0 h-px w-full bg-white/10" />
                <div className="absolute top-0 left-1/2 h-full w-px bg-white/10" />
              </div>
            </div>
            <figcaption className="mt-6 grid grid-cols-3 divide-x divide-white/15 border-y border-white/15 font-mono text-xs">
              <span className="py-3 pr-3">
                <span className="block text-ink-muted">Quality</span>
                <span className="mt-1 block text-ink-foreground">Gradable</span>
              </span>
              <span className="px-3 py-3">
                <span className="block text-ink-muted">Reference grade</span>
                <span className="mt-1 block text-ink-foreground">3 · Severe</span>
              </span>
              <span className="py-3 pl-3">
                <span className="block text-ink-muted">Action</span>
                <span className="mt-1 block text-signal">Refer urgently</span>
              </span>
            </figcaption>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">IDRiD sample image (CC BY 4.0) with its published reference grade.</p>
          </figure>
        </div>
      </section>

      {/* Problem: three numbers, told as one sentence */}
      <section id="problem" className="scroll-mt-16 bg-abyss text-ink-foreground" aria-labelledby="problem-title">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32">
          <p className="eyebrow text-signal">The problem</p>
          <h2 id="problem-title" className="font-display mt-6 max-w-5xl text-4xl text-balance sm:text-6xl">
            The world&apos;s highest diabetes rate. Too few eye doctors to check every diabetic retina once a year.
          </h2>
          <div className="mt-20">
            {STATS.map((s) => (
              <div key={s.value} className="grid items-baseline gap-4 border-t border-white/10 py-8 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-12">
                <span className="font-display text-7xl text-signal tabular-nums sm:text-8xl lg:text-9xl">{s.value}</span>
                <div>
                  <p className="max-w-xl text-xl leading-snug sm:text-2xl">{s.label}</p>
                  <a href={s.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-ink-muted underline-offset-4 hover:text-ink-foreground hover:underline">
                    {s.source} <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl text-base leading-relaxed text-ink-muted">
            <strong className="font-semibold text-ink-foreground">Our rough estimate, not a measurement:</strong> about 27% of people with
            diabetes have some retinopathy (meta-analysis cited in{" "}
            <a className="underline underline-offset-2" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9940560" target="_blank" rel="noreferrer">PMC9940560</a>).
            Applied to 34.5 million people, that is roughly 9 million Pakistanis, whom routine screening does not reach today.
          </p>
        </div>
      </section>

      {/* The fix: today vs with NazarAI, as two full-bleed panels */}
      <section aria-labelledby="solution-title" className="grid lg:grid-cols-2">
        <div className="bg-ink px-4 py-20 text-ink-foreground sm:px-10 lg:py-28 lg:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          <p className="eyebrow text-ink-muted">Today</p>
          <h2 id="solution-title" className="font-display mt-6 max-w-lg text-3xl text-ink-muted sm:text-5xl">The screening never happens.</h2>
          <ol className="mt-12 max-w-lg space-y-7">
            {BEFORE.map((t, i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr] text-lg leading-relaxed text-ink-muted">
                <span className="font-display text-2xl text-white/25">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-signal px-4 py-20 text-abyss sm:px-10 lg:py-28 lg:pr-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          <p className="eyebrow">With NazarAI</p>
          <p className="font-display mt-6 max-w-lg text-3xl sm:text-5xl">The screening comes to the patient.</p>
          <ol className="mt-12 max-w-lg space-y-7">
            {AFTER.map((t, i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr] text-lg leading-relaxed font-medium">
                <span className="font-display text-2xl">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 bg-abyss text-ink-foreground" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32">
          <p className="eyebrow text-signal">How it works</p>
          <h2 id="how-title" className="font-display mt-6 max-w-4xl text-4xl text-balance sm:text-6xl">
            One photo in. A graded, explained, referral-ready result out.
          </h2>
          <ol className="mt-16 grid gap-px overflow-hidden rounded-lg bg-white/10 md:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-abyss p-6 lg:p-7">
                <span className="font-display text-4xl text-signal">{s.n}</span>
                <h3 className="mt-6 text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-28">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="font-display max-w-2xl text-3xl sm:text-4xl">Five grades. Three actions.</h3>
              <p className="text-sm text-ink-muted">IDRiD images with their published reference grades · CC BY 4.0</p>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
              {GRADES.map((g) => (
                <li key={g.g}>
                  <div className="relative aspect-square overflow-hidden rounded-full bg-black ring-1 ring-white/10">
                    <Image src={`/demo/${g.file}`} alt={`Retina, reference grade ${g.g} (${g.label})`} fill sizes="220px" className="scale-[1.3] object-cover" />
                  </div>
                  <p className="font-display mt-5 text-2xl">
                    {g.g} <span className="text-lg text-ink-muted">{g.label}</span>
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                    <span className={`size-2.5 rounded-full ${TONE[g.tone]}`} aria-hidden="true" />
                    {g.action}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Evidence: light band for contrast and legibility */}
      <section className="bg-background" aria-labelledby="evidence-title">
        <div className="mx-auto grid max-w-7xl gap-16 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow text-primary">Evidence</p>
            <h2 id="evidence-title" className="font-display mt-6 text-4xl text-balance sm:text-5xl">
              Tested on 516 retina photos from India it never saw in training.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              The referral threshold was fixed on validation data, aiming for at least 90% sensitivity, then run once on the
              external IDRiD set. Missing a sick eye costs sight; an extra referral costs one visit.
            </p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Read honestly:</strong> it almost never misses a referable eye but
              over-refers (specificity 61.7%), most likely because scores shift between cameras; the cut-off was deliberately not
              re-tuned on the test set, so each new site needs calibration. IDx-DR used a different population, so it is a
              reference point, not a head-to-head.{" "}
              <Link href="/performance" className="font-semibold text-primary underline-offset-4 hover:underline">Full results</Link>
              {" · "}
              <a className="underline underline-offset-2" href="https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f" target="_blank" rel="noreferrer">IDx-DR source</a>
            </p>
          </div>
          <div className="rounded-lg bg-ink p-8 text-ink-foreground lg:p-10">
            <p className="text-sm text-ink-muted">Referable DR caught on the external test</p>
            <p className="font-display mt-3 text-8xl text-signal">99.4%</p>
            <p className="mt-2 text-ink-muted">321 of 323 referable eyes · IDx-DR reported 87%</p>
            <dl className="mt-10 divide-y divide-white/10 border-t border-white/10">
              {RESULTS.slice(1).map((r) => (
                <div key={r.metric} className="flex items-baseline justify-between gap-4 py-4">
                  <dt className="text-ink-muted">{r.metric}</dt>
                  <dd className="text-right">
                    <span className="font-display text-3xl">{r.ours}</span>
                    <span className="block text-xs text-ink-muted">IDx-DR: {r.bench}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Where it works */}
      <section className="border-t border-border bg-paper" aria-labelledby="where-title">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-28">
          <p className="eyebrow text-primary">Where it works</p>
          <h2 id="where-title" className="font-display mt-6 max-w-4xl text-4xl text-balance sm:text-5xl">
            Built for the clinics that already see diabetics.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A retina photo needs a fundus camera: a desktop unit, or a clinical handheld or smartphone adapter, operated by a
            trained health worker. An ordinary phone camera cannot see the retina.
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {SETTINGS.map((s, i) => (
              <div key={s.t} className="rounded-lg border-t-4 border-primary bg-card p-7 shadow-sm">
                <span className="font-display text-3xl text-primary/30">0{i + 1}</span>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA: the one bright band */}
      <section className="bg-signal text-abyss" aria-labelledby="cta-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h2 id="cta-title" className="font-display text-4xl text-balance sm:text-6xl">
              Screen a retina. See the heatmap. Print the Urdu slip.
            </h2>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 bg-abyss px-6 text-base text-ink-foreground hover:bg-ink">
                <Link href="/auth/sign-in?demo=health-worker">
                  Continue as health worker <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-abyss/40 bg-transparent px-6 text-base text-abyss hover:bg-abyss/10 hover:text-abyss">
                <Link href="/auth/sign-in?demo=eye-specialist">Continue as eye specialist</Link>
              </Button>
            </div>
          </div>
          <div className="border-t border-abyss/20 pt-6 text-sm leading-relaxed">
            <p>{DISCLAIMER.en}</p>
            <p dir="rtl" lang="ur" className="urdu mt-3 text-base">{DISCLAIMER.ur}</p>
          </div>
        </div>
      </section>
    </>
  );
}
