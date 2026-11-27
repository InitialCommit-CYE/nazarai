import { ArrowRight, CalendarCheck, CalendarClock, Plus, ScanEye } from "lucide-react";
import Link from "next/link";

import { patientFacts } from "@/components/clinical/patient-banner";
import { ReferralBadge } from "@/components/clinical/referral-badge";
import { EmptyState } from "@/components/site/page-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { requireViewer, type Viewer } from "@/lib/server/auth";
import { PATIENT_SUMMARY_COLUMNS } from "@/lib/server/supabase";
import type { PatientSummary, ReferralStatus, Urgency } from "@/lib/types";

/* The health worker's home: what to do in today's clinic, not a statistics page.
   "Due" = no gradable screening in the last 12 months (diabetic retinas should be checked once a year). */

const YEAR_MS = 365 * 86_400_000;
const pktDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" });
const pktLong = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" });

/** Request time. A server component renders once per request, so reading the clock here is safe. */
function requestTime(): number {
  return Date.now();
}

type Row = {
  id: string;
  patient_id: string | null;
  created_at: string;
  quality_ok: boolean;
  urgency: Urgency | null;
  referral_status: ReferralStatus;
  appointment_at: string | null;
};

type PatientStatus =
  | { kind: "today"; screening: Row }
  | { kind: "due"; last: Row | null }
  | { kind: "ok"; last: Row; nextDue: string };

export async function TodaysClinic({ viewer }: { viewer: Viewer }) {
  const { db } = await requireViewer({ next: "/dashboard", roles: ["operator"] });
  const now = requestTime();
  const since = new Date(now - 2 * YEAR_MS).toISOString();
  const [{ data: patientData }, { data: screeningData }] = await Promise.all([
    db.from("patients").select(PATIENT_SUMMARY_COLUMNS).order("full_name").limit(200),
    db
      .from("screenings")
      .select("id, patient_id, created_at, quality_ok, urgency, referral_status, appointment_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const patients = (patientData ?? []) as PatientSummary[];
  const screenings = (screeningData ?? []) as Row[];
  const byId = new Map(patients.map((p) => [p.id, p]));

  const today = pktDay.format(new Date(now));
  const isToday = (iso: string) => pktDay.format(new Date(iso)) === today;
  const todays = screenings.filter((s) => isToday(s.created_at));

  // Latest screening per patient (rows are newest first).
  const latest = new Map<string, Row>();
  const latestGraded = new Map<string, Row>();
  for (const s of screenings) {
    if (!s.patient_id) continue;
    if (!latest.has(s.patient_id)) latest.set(s.patient_id, s);
    if (s.quality_ok && !latestGraded.has(s.patient_id)) latestGraded.set(s.patient_id, s);
  }

  const status = (p: PatientSummary): PatientStatus => {
    const last = latest.get(p.id);
    if (last && isToday(last.created_at)) return { kind: "today", screening: last };
    const graded = latestGraded.get(p.id);
    if (!graded || now - new Date(graded.created_at).getTime() >= YEAR_MS) return { kind: "due", last: graded ?? null };
    return { kind: "ok", last: graded, nextDue: new Date(new Date(graded.created_at).getTime() + YEAR_MS).toISOString() };
  };
  const ORDER = { due: 0, today: 1, ok: 2 } as const;
  const list = patients.map((p) => ({ p, st: status(p) })).sort((a, b) => ORDER[a.st.kind] - ORDER[b.st.kind]);
  const dueCount = list.filter((r) => r.st.kind === "due").length;

  // One line per patient: their most urgent open referral that still needs an appointment.
  const seen = new Set<string>();
  const toBook = screenings
    .filter((s) => s.referral_status === "pending" && s.urgency && s.urgency !== "routine")
    .sort((a, b) => (a.urgency === b.urgency ? a.created_at.localeCompare(b.created_at) : a.urgency === "urgent" ? -1 : 1))
    .filter((s) => {
      const key = s.patient_id ?? s.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const booked = screenings
    .filter((s) => s.referral_status === "scheduled" && s.appointment_at && new Date(s.appointment_at).getTime() > now - 3_600_000)
    .sort((a, b) => (a.appointment_at ?? "").localeCompare(b.appointment_at ?? ""));

  const screenedToday = todays.filter((s) => s.quality_ok).length;
  const referredToday = todays.filter((s) => s.urgency === "refer" || s.urgency === "urgent").length;
  const retakesToday = todays.filter((s) => !s.quality_ok).length;
  const urgentToBook = toBook.filter((s) => s.urgency === "urgent").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-base text-muted-foreground">{viewer.clinicName ?? "Today’s clinic"}</p>
          <h1 className="font-display mt-2 text-5xl sm:text-6xl">{pktLong.format(new Date(now))}</h1>
          <p className="mt-3 max-w-3xl text-lg text-ink-muted sm:text-xl">
            {dueCount === 0 ? (
              "Every registered patient has been screened in the last 12 months."
            ) : (
              <>
                <strong className="text-foreground">
                  {dueCount} of {patients.length}
                </strong>{" "}
                patients are due for their yearly eye check.
              </>
            )}{" "}
            {urgentToBook > 0 && (
              <strong className="text-urgent">
                {urgentToBook} urgent referral{urgentToBook === 1 ? "" : "s"} still need{urgentToBook === 1 ? "s" : ""} booking.
              </strong>
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Today so far: <span className="text-foreground">{screenedToday}</span> screened · <span className="text-foreground">{referredToday}</span> referred ·{" "}
            <span className="text-foreground">{retakesToday}</span> retake{retakesToday === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/screen">
              <ScanEye /> Screen a patient
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/patients/new">
              <Plus /> New patient
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="gap-0 pb-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Patients and screening status</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-8">
              <Link href="/patients">
                All patients <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {list.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  title="No patients registered yet"
                  description="Register a patient to start screening."
                  action={
                    <Button asChild size="sm">
                      <Link href="/patients/new">New patient</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {list.map(({ p, st }) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3.5">
                    <div className="min-w-0">
                      <Link href={`/patients/${p.id}`} className="font-medium hover:underline">
                        {p.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">MR {p.mrn}</span> · {patientFacts(p).join(" · ")}
                      </p>
                    </div>
                    <PatientAction patientId={p.id} st={st} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Referrals to book</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {toBook.length === 0 ? (
                <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">Nothing to book. Every referral has an appointment.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {toBook.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <Link href={`/screenings/${s.id}`} className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{(s.patient_id && byId.get(s.patient_id)?.full_name) ?? "Unknown patient"}</p>
                          <p className="text-xs text-muted-foreground">Screened {formatDate(s.created_at)}</p>
                        </div>
                        <ReferralBadge urgency={s.urgency as Urgency} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Upcoming specialist appointments</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {booked.length === 0 ? (
                <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">No appointments booked yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {booked.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <Link href={`/screenings/${s.id}`} className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
                        <span className="min-w-0 truncate text-sm font-medium">{(s.patient_id && byId.get(s.patient_id)?.full_name) ?? "Unknown patient"}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarCheck className="size-3.5 text-primary" aria-hidden />
                          {formatDateTime(s.appointment_at as string)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PatientAction({ patientId, st }: { patientId: string; st: PatientStatus }) {
  if (st.kind === "today") {
    const s = st.screening;
    return (
      <div className="flex items-center gap-2">
        {s.quality_ok && s.urgency ? <ReferralBadge urgency={s.urgency} /> : <span className="text-xs font-medium text-refer">Retake needed</span>}
        <span className="hidden text-xs text-muted-foreground sm:inline">{formatTime(s.created_at)}</span>
        <Button asChild size="sm" variant="ghost" className="h-8">
          <Link href={s.quality_ok ? `/screenings/${s.id}` : `/screen?patient=${patientId}`}>
            {s.quality_ok ? "Result" : "Retake"} <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }
  if (st.kind === "due") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-refer">
          <CalendarClock className="size-3.5" aria-hidden />
          {st.last ? `Due · last ${formatDate(st.last.created_at)}` : "Due · never screened"}
        </span>
        <Button asChild size="sm" className="h-8">
          <Link href={`/screen?patient=${patientId}`}>
            <ScanEye /> Screen
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Next due {formatDate(st.nextDue)}</span>
      <Button asChild size="sm" variant="ghost" className="h-8">
        <Link href={`/screenings/${st.last.id}`}>
          Last result <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
