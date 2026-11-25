"use client";

import { AlertCircle, CalendarClock, FileText, Layers, Plus, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DevModelBanner } from "@/components/clinical/notices";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getScreening } from "@/lib/client/api";
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
  const [loaded, setLoaded] = useState<{ id: string; value?: Omit<ScreeningContextValue, "role" | "update">; error?: string } | null>(null);
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
    { href: `/screenings/${id}/explain`, label: "Explainability", short: "Grad-CAM", icon: Layers },
    { href: `/screenings/${id}/report`, label: "Patient report", short: "Report", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Screening result</p>
          {state ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <UserRound className="size-4" />
                {staff && state.screening.patient_id ? (
                  <Link href={`/patients/${state.screening.patient_id}`} className="hover:underline">
                    {state.screening.demo_patient_code ?? "Patient record"}
                  </Link>
                ) : (
                  (state.screening.demo_patient_code ?? "No reference")
                )}
              </span>
              {state.screening.age != null && <span>Age {state.screening.age}</span>}
              {state.screening.diabetes_duration_years != null && <span>{state.screening.diabetes_duration_years} yrs diabetes</span>}
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-4" /> {formatDateTime(state.screening.created_at)}
              </span>
            </div>
          ) : (
            !error && <Skeleton className="mt-2 h-6 w-72" />
          )}
        </div>
        {staff ? (
          <Button asChild variant="outline">
            <Link href={state?.screening.patient_id ? `/screen?patient=${state.screening.patient_id}` : "/screen"}>
              <Plus /> New screening
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/my">My results</Link>
          </Button>
        )}
      </div>

      <nav aria-label="Screening sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
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
