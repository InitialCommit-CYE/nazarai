"use client";

import { Clock, Database, FlaskConical, Hourglass, Info, Microscope, ServerCrash } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMetrics } from "@/lib/client/api";
import { GRADES } from "@/lib/clinical";
import { formatDateTime, pct } from "@/lib/format";
import type { MetricsComplete, MetricsResponse, SplitMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ConfusionMatrix } from "./confusion-matrix";
import { RocChart, SERIES_COLORS } from "./roc-chart";

type SplitKey = "validation" | "external_test";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Pending({ m }: { m: Exclude<MetricsResponse, MetricsComplete> }) {
  const Icon = m.status === "pending" ? Hourglass : ServerCrash;
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold">{m.status === "pending" ? "Evaluation pending" : "Results unavailable"}</h2>
        <p className="max-w-lg text-muted-foreground">{m.detail}</p>
        <p className="max-w-lg text-sm text-muted-foreground">
          This page shows only numbers from the real evaluation artefact (<code>ml/reports/metrics.json</code>), produced by
          running the trained model on the validation split and the external IDRiD test set. No placeholder metrics are shown.
        </p>
      </CardContent>
    </Card>
  );
}

function SplitTiles({ s }: { s: SplitMetrics }) {
  const r = s.referable;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Quadratic weighted kappa" value={s.qwk.toFixed(3)} hint="5-grade agreement (1 = perfect)" />
      <Tile label="Sensitivity" value={pct(r.sensitivity)} hint={`Referable DR · ${r.tp}/${r.tp + r.fn} detected`} />
      <Tile label="Specificity" value={pct(r.specificity)} hint={`${r.tn}/${r.tn + r.fp} correctly not referred`} />
      <Tile label="AUC-ROC" value={r.auc?.toFixed(3) ?? "–"} hint="Referable vs non-referable" />
    </div>
  );
}

export function PerformanceDashboard() {
  const [m, setM] = useState<MetricsResponse | null>(null);
  const [split, setSplit] = useState<SplitKey>("external_test");

  useEffect(() => {
    getMetrics()
      .then(setM)
      .catch(() => setM({ status: "unavailable", detail: "The metrics service could not be reached." }));
  }, []);

  if (!m) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (m.status !== "complete") return <Pending m={m} />;

  const available = (["external_test", "validation"] as const).filter((k) => m.splits[k]);
  const key = m.splits[split] ? split : available[0];
  const s = m.splits[key]!;
  const v = m.splits.validation;
  const t = m.splits.external_test;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Evaluation set" className="inline-flex rounded-xl border border-border bg-muted p-1">
          {available.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={key === k}
              onClick={() => setSplit(k)}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium", key === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[k] }} aria-hidden="true" />
              {m.splits[k]!.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Model <span className="font-medium text-foreground">{m.model.model_version}</span> · evaluated {formatDateTime(m.generated_at)}
        </p>
      </div>

      <section aria-label={`${s.name} headline metrics`} className="space-y-2">
        <SplitTiles s={s} />
        <p className="text-sm text-muted-foreground">{s.description} · {s.n_images} images.</p>
      </section>

      {v && t && v.referable.specificity != null && t.referable.specificity != null &&
        v.referable.specificity - t.referable.specificity > 0.1 && (
          <div className="flex gap-2.5 rounded-[20px] border border-white/10 bg-[#121418] p-4 text-sm leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-refer" aria-hidden="true" />
            <p>
              <strong className="font-medium text-foreground">Specificity drops on the external set</strong> ({pct(v.referable.specificity)} validation →{" "}
              {pct(t.referable.specificity)} {t.name}) while sensitivity is {pct(t.referable.sensitivity)}. The referral
              cut-off was fixed on validation data from different cameras and was not re-tuned on the test set; the
              confusion matrix shows where the extra referrals come from. Each new site or camera needs threshold
              calibration before clinical use.
            </p>
          </div>
        )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benchmark comparison: referable DR</CardTitle>
            <CardDescription>NazarAI at its deployed, sensitivity-first threshold vs the published IDx-DR pivotal-trial figures.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  {v && <TableHead className="text-right">Validation</TableHead>}
                  {t && <TableHead className="text-right">External (IDRiD)</TableHead>}
                  <TableHead className="text-right">IDx-DR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {(
                  [
                    ["Sensitivity", "sensitivity", m.benchmark.sensitivity],
                    ["Specificity", "specificity", m.benchmark.specificity],
                    ["PPV", "ppv", null],
                    ["NPV", "npv", null],
                    ["AUC-ROC", "auc", null],
                  ] as const
                ).map(([label, k, b]) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{label}</TableCell>
                    {v && <TableCell className="text-right">{k === "auc" ? v.referable.auc?.toFixed(3) ?? "–" : pct(v.referable[k])}</TableCell>}
                    {t && <TableCell className="text-right">{k === "auc" ? t.referable.auc?.toFixed(3) ?? "–" : pct(t.referable[k])}</TableCell>}
                    <TableCell className="text-right text-muted-foreground">{b != null ? pct(b, 0) : "not reported"}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">QWK (5 grades)</TableCell>
                  {v && <TableCell className="text-right">{v.qwk.toFixed(3)}</TableCell>}
                  {t && <TableCell className="text-right">{t.qwk.toFixed(3)}</TableCell>}
                  <TableCell className="text-right text-muted-foreground">n/a</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {m.benchmark.note} IDx-DR: {m.benchmark.definition}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ROC curve: referable DR</CardTitle>
            <CardDescription>Dots mark the deployed referral threshold ({m.model.referral_threshold.toFixed(2)}); ✕ marks IDx-DR.</CardDescription>
          </CardHeader>
          <CardContent>
            <RocChart metrics={m} />
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Operating points as a table</summary>
              <ul className="mt-2 space-y-1">
                {available.map((k) => {
                  const op = m.splits[k]!.roc?.operating_point;
                  return (
                    <li key={k}>
                      {m.splits[k]!.name}: sensitivity {pct(op?.tpr)}, false-positive rate {pct(op?.fpr)}
                    </li>
                  );
                })}
                <li>IDx-DR: sensitivity {pct(m.benchmark.sensitivity, 0)}, false-positive rate {pct(1 - m.benchmark.specificity, 0)}</li>
              </ul>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confusion matrix: {s.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfusionMatrix matrix={s.confusion_matrix} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by DR grade: {s.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Images</TableHead>
                  <TableHead className="text-right">Recall</TableHead>
                  <TableHead className="text-right">Precision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {s.per_grade.map((p) => (
                  <TableRow key={p.grade}>
                    <TableCell className="font-medium">{p.grade} · {GRADES[p.grade].short}</TableCell>
                    <TableCell className="text-right">{p.support}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block" aria-hidden="true">
                          <span className="block h-full rounded-full" style={{ width: `${(p.recall ?? 0) * 100}%`, background: SERIES_COLORS[key] }} />
                        </span>
                        {pct(p.recall, 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{pct(p.precision, 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">Exact 5-grade accuracy: {pct(s.accuracy)}. Grade 0 dominates most datasets, so per-grade recall matters.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4 text-primary" /> Training data</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Sources: <span className="text-foreground">{m.model.train_sources?.join(", ") ?? "–"}</span></p>
            {m.model.n_train != null && <p>{m.model.n_train.toLocaleString()} training images, patient-level split</p>}
            <p>Backbone: {m.model.pretrained_weights}, {m.model.image_size}px</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Microscope className="size-4 text-primary" /> External test</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {t ? (
              <>
                <p>{t.description}</p>
                <p>Grade mix: {t.grade_distribution.map((n, i) => `G${i} ${n}`).join(" · ")}</p>
              </>
            ) : (
              <p>Not evaluated yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4 text-primary" /> Inference speed</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="text-2xl font-semibold text-foreground">{m.inference.mean_ms != null ? `${(m.inference.mean_ms / 1000).toFixed(2)} s` : "–"}</p>
            <p>Mean per image (p95 {m.inference.p95_ms != null ? `${(m.inference.p95_ms / 1000).toFixed(2)} s` : "–"}), {m.inference.includes}</p>
            <p>{m.inference.device}</p>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Thresholds were tuned on validation data only; the external test set was never used for training or tuning.
          Numbers are reported as measured, including where they fall below the benchmark.{" "}
          <Badge variant="outline" className="ml-1">Source: ml/reports/metrics.json</Badge>
        </span>
      </p>
    </div>
  );
}
