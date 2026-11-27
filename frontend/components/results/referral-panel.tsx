"use client";

import { CalendarCheck, CheckCheck, Loader2, Save, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { reviewReferral } from "@/app/screenings/actions";
import { ReferralStatusBadge } from "@/components/clinical/referral-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { ReferralStatus, ScreeningRecord } from "@/lib/types";

const PKT_MS = 5 * 3_600_000;

/**
 * Datetime-local value in Pakistan time (UTC+5) for an ISO timestamp. With no appointment yet, it suggests a
 * clinic slot: 10:00 a few days ahead, moved off Sunday (it used to suggest the current clock time, e.g. 03:18).
 */
export function toPktInput(iso: string | null, daysAhead = 2): string {
  if (iso) return new Date(new Date(iso).getTime() + PKT_MS).toISOString().slice(0, 16);
  const day = new Date(Date.now() + PKT_MS + daysAhead * 86_400_000); // UTC fields now read as Pakistan time
  if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}T10:00`;
}

/** The eye specialist's side of a referral: appointment, clinical note, and the outcome (seen / closed). */
export function ReferralPanel({ screening, onChange }: { screening: ScreeningRecord; onChange: (s: Partial<ScreeningRecord>) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [when, setWhen] = useState(toPktInput(screening.appointment_at));
  const [note, setNote] = useState("");

  function submit(status: Exclude<ReferralStatus, "not_required">, msg: string) {
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await reviewReferral({ id: screening.id, status, appointmentAt: status === "scheduled" ? when : undefined, note: note.trim() || undefined });
      if (r.error) return setError(r.error);
      onChange({
        referral_status: status,
        appointment_at: status === "scheduled" ? new Date(`${when}:00+05:00`).toISOString() : screening.appointment_at,
        specialist_note: note.trim() || screening.specialist_note,
        reviewed_at: new Date().toISOString(),
      });
      setNote("");
      setSaved(msg);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          Specialist review <ReferralStatusBadge status={screening.referral_status} />
        </CardTitle>
        <CardDescription>
          {screening.referral_status === "scheduled" && screening.appointment_at
            ? `Appointment: ${formatDateTime(screening.appointment_at)}`
            : "Record your findings and the outcome after examining the patient. The AI result cannot be edited."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {screening.specialist_note && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Specialist note</p>
            <p className="mt-1 whitespace-pre-wrap">{screening.specialist_note}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="appt">Appointment (Pakistan time)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="appt" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 rounded-2xl bg-white/[0.05]" disabled={pending} />
            <Button variant="outline" className="shrink-0" disabled={pending} onClick={() => submit("scheduled", "Appointment booked. The patient is notified if their account is linked.")}>
              <CalendarCheck /> Book
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Clinical note</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Findings and plan after examination" disabled={pending} className="min-h-24 rounded-2xl bg-white/[0.05]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => submit("seen", "Marked as seen by the specialist.")}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark as seen
          </Button>
          {note.trim() && (
            <Button variant="outline" disabled={pending} onClick={() => submit(screening.referral_status === "not_required" ? "pending" : (screening.referral_status as Exclude<ReferralStatus, "not_required">), "Note saved.")}>
              <Save /> Save note only
            </Button>
          )}
          <Button variant="ghost" disabled={pending} onClick={() => submit("closed", "Referral closed.")} className="text-muted-foreground">
            <XCircle /> Close referral
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-routine" role="status">
            {saved}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
