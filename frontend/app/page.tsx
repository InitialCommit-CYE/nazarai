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
            <h1 className="font-display mt-6 text-4xl leading-[1.05] font-normal text-balance sm:text-5xl lg:text-[4.1rem]">
              Diabetes takes sight without a single symptom.{" "}
              <em className="text-signal">In Pakistan, diabetic eyes are not routinely checked.</em>
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

      {/* 01 Problem */}
      <section id="problem" className="scroll-mt-16 border-b border-border" aria-labelledby="problem-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-primary">01 · The problem</p>
            <div>
              <h2 id="problem-title" className="font-display text-3xl leading-tight font-normal text-balance sm:text-[2.75rem]">
                Every person with diabetes needs a retina check once a year. Pakistan does not have the eye doctors to do it.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Diabetic patients in Pakistan are not routinely screened. High blood sugar slowly damages the vessels of the
                retina; by the time a patient notices, the loss is usually permanent. Laser and injections work, but only if
                the disease is found early.
              </p>
            </div>
          </div>

          <dl className="mt-16 grid border-t border-foreground/80 md:grid-cols-3 md:divide-x md:divide-border">
            {STATS.map((s) => (
              <div key={s.value} className="border-b border-border py-8 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="font-display block text-6xl font-normal tracking-tight text-foreground lg:text-7xl">{s.value}</span>
                  <span className="mt-4 block max-w-xs text-base leading-relaxed">{s.label}</span>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {s.source} <ArrowUpRight className="size-3" />
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Our rough estimate, not a measurement:</strong> about 27% of
            people with diabetes have some retinopathy (meta-analysis cited in{" "}
            <a className="underline underline-offset-2" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9940560" target="_blank" rel="noreferrer">
              PMC9940560
            </a>
            ). Applied to 34.5 million people, that is roughly 9 million Pakistanis, whom routine screening does not reach today.
          </p>
        </div>
      </section>

      {/* 02 Solution: before / after */}
      <section className="border-b border-border bg-paper" aria-labelledby="solution-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-primary">02 · The fix</p>
            <h2 id="solution-title" className="font-display text-3xl leading-tight font-normal text-balance sm:text-[2.75rem]">
              Move the screening to where diabetics already are. Send the specialist only the patients who need one.
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
            <div className="bg-background p-8 lg:p-10">
              <p className="eyebrow text-muted-foreground">Today</p>
              <ol className="mt-6 space-y-5">
                {BEFORE.map((t, i) => (
                  <li key={t} className="grid grid-cols-[2rem_1fr] gap-2 text-base leading-relaxed text-muted-foreground">
                    <span className="font-mono text-sm">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-card p-8 lg:p-10">
              <p className="eyebrow text-primary">With NazarAI</p>
              <ol className="mt-6 space-y-5">
                {AFTER.map((t, i) => (
                  <li key={t} className="grid grid-cols-[2rem_1fr] gap-2 text-base leading-relaxed">
                    <span className="font-mono text-sm text-primary">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 03 How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-b border-border" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-primary">03 · How it works</p>
            <h2 id="how-title" className="font-display text-3xl leading-tight font-normal text-balance sm:text-[2.75rem]">
              One photo in. A graded, explained, referral-ready result out.
            </h2>
          </div>
          <ol className="mt-14 grid border-t border-foreground/80 md:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="border-b border-border py-6 md:border-b-0 md:border-l md:px-5 md:first:border-l-0 md:first:pl-0">
                <span className="font-mono text-sm text-primary">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="font-display text-2xl font-normal">What the five grades look like, and what happens next</h3>
              <p className="font-mono text-xs text-muted-foreground">IDRiD images, published reference grades · CC BY 4.0</p>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {GRADES.map((g) => (
                <li key={g.g}>
                  <div className="relative aspect-square overflow-hidden rounded-full bg-black">
                    <Image src={`/demo/${g.file}`} alt={`Retina, reference grade ${g.g} (${g.label})`} fill sizes="220px" className="scale-[1.3] object-cover" />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-border pt-3">
                    <span className="font-semibold">
                      <span className="font-mono text-sm text-muted-foreground">G{g.g}</span> {g.label}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={`size-2 rounded-full ${TONE[g.tone]}`} aria-hidden="true" />
                    {g.action}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 Evidence */}
      <section className="border-b border-border bg-paper" aria-labelledby="evidence-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-primary">04 · Evidence</p>
            <div>
              <h2 id="evidence-title" className="font-display text-3xl leading-tight font-normal text-balance sm:text-[2.75rem]">
                Tested on 516 retina photos from India that it never saw during training.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                The referral threshold was fixed on validation data, aiming for at least 90% sensitivity, then the model was
                run once on the external IDRiD set. Missing a sick eye costs sight; an extra referral costs one visit.
              </p>
            </div>
          </div>

          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-t border-foreground/80 text-left">
              <thead>
                <tr className="border-b border-border font-mono text-xs text-muted-foreground uppercase">
                  <th className="py-4 pr-6 font-normal">Referable DR (grade ≥ 2)</th>
                  <th className="py-4 pr-6 font-normal">NazarAI · external test (IDRiD, n = 516)</th>
                  <th className="py-4 font-normal">IDx-DR · FDA pivotal trial (reported)</th>
                </tr>
              </thead>
              <tbody>
                {RESULTS.map((r) => (
                  <tr key={r.metric} className="border-b border-border align-baseline">
                    <th scope="row" className="py-6 pr-6 text-base font-medium">{r.metric}</th>
                    <td className="py-6 pr-6">
                      <span className="font-display text-4xl">{r.ours}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{r.detail}</span>
                    </td>
                    <td className="py-6 font-display text-2xl text-muted-foreground">{r.bench}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 grid gap-6 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
            <p>
              <strong className="font-semibold text-foreground">Read honestly:</strong> the model almost never misses a referable
              eye, but it over-refers (specificity 61.7%), most likely because scores shift between cameras and the cut-off was deliberately
              not re-tuned on the test set. Each new site needs threshold calibration, the first step of a pilot. IDx-DR used a
              different population and reference standard, so it is a reference point, not a head-to-head comparison.
            </p>
            <p>
              Trained on APTOS 2019 (India) and EyePACS, 33,229 images.{" "}
              <Link href="/performance" className="font-medium text-primary underline-offset-4 hover:underline">
                Full validation and test results, confusion matrices and ROC curve
              </Link>
              . Source for IDx-DR:{" "}
              <a className="underline underline-offset-2" href="https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f" target="_blank" rel="noreferrer">AAO</a>.
            </p>
          </div>
        </div>
      </section>

      {/* 05 Where it works */}
      <section className="border-b border-border" aria-labelledby="where-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-primary">05 · Where it works</p>
            <div>
              <h2 id="where-title" className="font-display text-3xl leading-tight font-normal text-balance sm:text-[2.75rem]">
                Built for the clinics that already see diabetics, not for the eye hospital.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                A retina photo needs a fundus camera, a desktop unit or a clinical handheld or smartphone adapter, operated by
                a trained health worker. An ordinary phone camera cannot see the retina.
              </p>
            </div>
          </div>
          <div className="mt-14 grid border-t border-foreground/80 md:grid-cols-3 md:divide-x md:divide-border">
            {SETTINGS.map((s) => (
              <div key={s.t} className="border-b border-border py-8 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
                <h3 className="text-lg font-semibold">{s.t}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety + CTA */}
      <section className="bg-ink text-ink-foreground" aria-labelledby="cta-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow text-signal">Try the clinic workflow</p>
            <h2 id="cta-title" className="font-display mt-5 text-3xl leading-tight font-normal text-balance sm:text-5xl">
              Screen a sample retina, see the heatmap, print the Urdu referral slip.
            </h2>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 bg-ink-foreground px-6 text-base text-ink hover:bg-white">
                <Link href="/auth/sign-in?demo=health-worker">
                  Continue as health worker <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent px-6 text-base text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
              >
                <Link href="/auth/sign-in?demo=eye-specialist">Continue as eye specialist</Link>
              </Button>
            </div>
          </div>
          <div className="border-t border-white/15 pt-6 text-sm leading-relaxed text-ink-muted">
            <p>{DISCLAIMER.en}</p>
            <p dir="rtl" lang="ur" className="urdu mt-3 text-base text-ink-foreground/90">
              {DISCLAIMER.ur}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
