"use client";

import { AlertCircle, CalendarClock, FileText, Layers, Plus, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DevModelBanner } from "@/components/clinical/notices";
import { PatientBanner } from "@/components/clinical/patient-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getScreening } from "@/lib/client/api";
import { primedScreening } from "@/lib/client/screening-cache";
import { loadSessionImages } from "@/lib/client/session-images";
import { formatDateTime } from "@/lib/format";
import type { AppRole } from "@/lib/roles";
import type { ScreeningRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ScreeningContext, type ScreeningContextValue } from "./screening-context";

export function ScreeningShell({ children, role }: { children: React.ReactNode; role: AppRole }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  // Results are keyed by id, so navigating to another screening never shows stale data.
  // Straight after a screening the record is already in memory, so the result renders on arrival.
  const [loaded, setLoaded] = useState<{ id: string; value?: Omit<ScreeningContextValue, "role" | "update">; error?: string } | null>(() => {
    const primed = primedScreening(id);
    return primed ? { id, value: { screening: primed, images: loadSessionImages(id) } } : null;
  });
  const update = (patch: Partial<ScreeningRecord>) =>
    setLoaded((l) => (l?.value ? { ...l, value: { ...l.value, screening: { ...l.value.screening, ...patch } } } : l));

  useEffect(() => {
    let cancelled = false;
    getScreening(id)
      .then(({ screening }) => !cancelled && setLoaded({ id, value: { screening, images: loadSessionImages(id) } }))
      .catch((e) => !cancelled && setLoaded({ id, error: e instanceof ApiError ? e.message : "Could not load this screening." }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = loaded?.id === id ? loaded : null;
  const state: ScreeningContextValue | null = current?.value ? { ...current.value, role, update } : null;
  const staff = role !== "patient";
  const error = current?.error ?? null;

  const tabs = [
    { href: `/screenings/${id}`, label: "Result", short: "Result", icon: Stethoscope },
    { href: `/screenings/${id}/explain`, label: "Explainability", short: "Heatmap", icon: Layers },
    { href: `/screenings/${id}/report`, label: "Patient report", short: "Report", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-primary">
          Screening result
          {state && (
            <span className="flex items-center gap-1.5 font-normal text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden /> {formatDateTime(state.screening.created_at)}
            </span>
          )}
        </p>
        {staff ? (
          <Button asChild variant="outline" size="sm">
            <Link href={state?.screening.patient_id ? `/screen?patient=${state.screening.patient_id}` : "/screen"}>
              <Plus /> Screen again
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/my">My results</Link>
          </Button>
        )}
      </div>

      <div className="mt-3">
        {state?.screening.patient ? (
          <PatientBanner
            patient={state.screening.patient}
            href={staff && state.screening.patient_id ? `/patients/${state.screening.patient_id}` : undefined}
          />
        ) : state ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              <UserRound className="size-4" />
              {state.screening.demo_patient_code ?? "No reference"}
            </span>
            {state.screening.age != null && <span>Age {state.screening.age}</span>}
            {state.screening.diabetes_duration_years != null && <span>{state.screening.diabetes_duration_years} yrs diabetes</span>}
          </div>
        ) : (
          !error && <Skeleton className="h-[62px] w-full rounded-xl" />
        )}
      </div>

      <nav aria-label="Screening sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 sm:px-4 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 space-y-6">
        {state && !state.screening.model_trained && <DevModelBanner modelVersion={state.screening.model_version} />}
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Screening unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!state && !error && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        )}
        {state && <ScreeningContext.Provider value={state}>{children}</ScreeningContext.Provider>}
      </div>
    </div>
  );
}
