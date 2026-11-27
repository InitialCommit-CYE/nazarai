"use client";

import { AlertCircle, Download, RefreshCcw, Sparkles, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ReferralBadge, URGENCY_STYLE } from "@/components/clinical/referral-badge";
import { QualityFeedback } from "@/components/screening/quality-feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getReport, pdfUrl } from "@/lib/client/api";
import { BORDERLINE_NOTE, DISCLAIMER, GRADES, URGENCY_INFO } from "@/lib/clinical";
import { formatDateTime } from "@/lib/format";
import type { Language, ReportResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

import { useScreening } from "./screening-context";

const UI: Record<Language, Record<string, string>> = {
  en: {
    title: "Eye screening report",
    result: "Screening result",
    meaning: "What this means",
    next: "What to do next",
    note: "Important",
    ref: "Patient reference",
    date: "Date",
  },
  ur: {
    title: "آنکھوں کی اسکریننگ رپورٹ",
    result: "اسکریننگ کا نتیجہ",
    meaning: "اس کا کیا مطلب ہے",
    next: "آگے کیا کریں",
    note: "اہم بات",
    ref: "مریض کا حوالہ",
    date: "تاریخ",
  },
};

function LanguageSwitcher({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  return (
    <div role="radiogroup" aria-label="Report language" className="inline-flex rounded-xl border border-border bg-muted p-1">
      {(["en", "ur"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            value === l ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            l === "ur" && "urdu py-0 text-base",
          )}
        >
          {l === "en" ? "English" : "اردو"}
        </button>
      ))}
    </div>
  );
}

export function PatientReport() {
  const { screening: s } = useScreening();
  const [lang, setLang] = useState<Language>("ur");
  const [reports, setReports] = useState<Partial<Record<Language, ReportResponse>>>({});
  const [errors, setErrors] = useState<Partial<Record<Language, string>>>({});
  const [regenerating, setRegenerating] = useState(false);

  const store = useCallback((l: Language, p: Promise<ReportResponse>) => {
    return p
      .then((r) => {
        setReports((prev) => ({ ...prev, [l]: r }));
        setErrors((prev) => ({ ...prev, [l]: undefined }));
      })
      .catch((e) =>
        setErrors((prev) => ({ ...prev, [l]: e instanceof ApiError ? e.message : "Could not generate the report." })),
      );
  }, []);

  // Fetch (or generate) the report the first time each language is shown.
  useEffect(() => {
    if (!s.quality_ok || reports[lang] || errors[lang]) return;
    void store(lang, getReport(s.id, lang));
  }, [lang, reports, errors, s.id, s.quality_ok, store]);

  const regenerate = () => {
    setRegenerating(true);
    void store(lang, getReport(s.id, lang, true)).finally(() => setRegenerating(false));
  };
  const error = errors[lang] ?? null;
  const loading = regenerating || (!reports[lang] && !error);

  if (!s.quality_ok || s.grade == null || !s.urgency) return <QualityFeedback issues={s.quality_issues} />;

  const report = reports[lang];
  const g = GRADES[s.grade];
  const t = UI[lang];
  const rtl = lang === "ur";
  const style = URGENCY_STYLE[s.urgency];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LanguageSwitcher value={lang} onChange={setLang} />
        <div className="flex flex-wrap gap-2">
          {/* Only reworded reports can be regenerated; the fixed template would come back identical. */}
          {report?.generator === "claude" && (
            <Button variant="outline" onClick={regenerate} disabled={loading}>
              <RefreshCcw className={loading ? "animate-spin" : undefined} /> Regenerate
            </Button>
          )}
          <Button asChild>
            <a href={pdfUrl(s.id, lang)} download>
              <Download /> Download PDF referral slip
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Report unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <article
        dir={rtl ? "rtl" : "ltr"}
        lang={lang}
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        aria-busy={loading}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-secondary/50 px-6 py-5">
          <div>
            <h2 className={cn("text-xl font-semibold", rtl && "urdu text-2xl font-semibold")}>{t.title}</h2>
            <p className={cn("text-sm text-muted-foreground", rtl && "urdu")}>
              {t.ref}: <span dir="ltr">{s.demo_patient_code ?? "–"}</span> · {t.date}: <span dir="ltr">{formatDateTime(s.created_at)}</span>
            </p>
          </div>
          <ReferralBadge urgency={s.urgency} lang={lang} />
        </header>

        <div className={cn("space-y-6 px-6 py-6", rtl && "urdu text-lg")}>
          <section>
            <h3 className={cn("text-sm font-semibold text-muted-foreground")}>{t.result}</h3>
            <p className="mt-1 text-lg font-semibold">{g.label[lang]}</p>
          </section>

          <section>
            <h3 className={cn("text-sm font-semibold text-muted-foreground")}>{t.meaning}</h3>
            {loading && !report ? (
              <div className="mt-2 space-y-2" aria-label="Generating report">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : (
              report?.body.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="mt-2 leading-relaxed">
                  {p}
                </p>
              ))
            )}
          </section>

          <section className={cn("rounded-xl p-4", style.solid)}>
            <h3 className="text-sm font-semibold opacity-90">{t.next}</h3>
            <p className="mt-1 font-semibold">{URGENCY_INFO[s.urgency].action[lang]}</p>
            {s.borderline && <p className="mt-2 text-sm opacity-95">{BORDERLINE_NOTE[lang]}</p>}
          </section>

          <section className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
            <h3 className="font-semibold">{t.note}</h3>
            <p className="mt-1">{DISCLAIMER[lang]}</p>
          </section>
        </div>

        <footer dir="ltr" className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3 text-xs text-muted-foreground">
          {report?.generator === "claude" ? (
            <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> Wording by Claude ({report.llm_model})</Badge>
          ) : report ? (
            <Badge variant="secondary" className="gap-1"><FileText className="size-3" /> Standard approved template</Badge>
          ) : null}
          <span>
            {report?.generator === "claude"
              ? "The explanation is generated only from the stored model result. The grade, referral and disclaimer are fixed texts and cannot be changed by the language model."
              : "Fixed wording in English and Urdu, filled in only from the stored model result."}
          </span>
        </footer>
      </article>
    </div>
  );
}
