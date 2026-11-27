"use client";

import { ArrowRight, CalendarCheck, CalendarClock, Check, Download, FileText, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { reviewReferral } from "@/app/screenings/actions";
import { ReferralStatusBadge } from "@/components/clinical/referral-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pdfUrl } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ScreeningRecord, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

import { toPktInput } from "./referral-panel";

const YEAR_MS = 365 * 86_400_000;

/**
 * The health worker's checklist after a result: explain it, book the follow-up, hand over the slip.
 * Recording the specialist's outcome (seen / closed) is the eye specialist's job, so it is not offered here.
 */
export function CarePlan({ screening: s, urgency, onChange }: { screening: ScreeningRecord; urgency: Urgency; onChange: (s: Partial<ScreeningRecord>) => void }) {
  const referral = urgency !== "routine";
  const booked = s.referral_status === "scheduled" || s.referral_status === "seen" || s.referral_status === "closed";

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-xl font-medium tracking-tight">
          Before the patient leaves
          {referral && <ReferralStatusBadge status={s.referral_status} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-5">
          <Step n={1} title="Explain the result to the patient">
            <p className="text-sm text-muted-foreground">A plain-language report they can read in Urdu or English.</p>
            <Button asChild size="sm" variant="outline" className="mt-2.5">
              <Link href={`/screenings/${s.id}/report`}>
                <FileText /> Open patient report <ArrowRight />
              </Link>
            </Button>
          </Step>

          {referral ? (
            <Step n={2} title={urgency === "urgent" ? "Book the eye specialist urgently" : "Book the eye specialist appointment"} done={booked}>
              <Booking screening={s} urgent={urgency === "urgent"} onChange={onChange} />
            </Step>
          ) : (
            <Step n={2} title="Plan the next screening" done>
              <p className="flex items-center gap-2 text-sm">
                <CalendarClock className="size-4 text-routine" aria-hidden />
                <span>
                  No referral needed. Rescreen due{" "}
                  <strong className="font-semibold">{formatDate(new Date(new Date(s.created_at).getTime() + YEAR_MS).toISOString())}</strong>
                </span>
              </p>
            </Step>
          )}

          <Step n={3} title={referral ? "Give the patient the referral slip" : "Give the patient their result slip"}>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={pdfUrl(s.id, "ur")} download>
                  <Download /> Slip in Urdu
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={pdfUrl(s.id, "en")} download>
                  <Download /> Slip in English
                </a>
              </Button>
            </div>
          </Step>
        </ol>

        {s.specialist_note && (
          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Eye specialist&apos;s note</p>
            <p className="mt-1 whitespace-pre-wrap">{s.specialist_note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-4 border-t border-white/[0.07] pt-5 first:border-0 first:pt-0">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-sm font-medium",
          done ? "bg-foreground text-background" : "border-2 border-white/20 bg-transparent text-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-base font-medium">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h3>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

function Booking({ screening: s, urgent, onChange }: { screening: ScreeningRecord; urgent: boolean; onChange: (s: Partial<ScreeningRecord>) => void }) {
  const [pending, start] = useTransition();
  const [when, setWhen] = useState(toPktInput(s.appointment_at));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (s.referral_status === "seen" || s.referral_status === "closed") {
    return <p className="text-sm text-muted-foreground">The eye specialist has recorded the outcome.</p>;
  }

  if (s.referral_status === "scheduled" && s.appointment_at && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CalendarCheck className="size-4 text-primary" aria-hidden />
        <span>
          Booked for <strong className="font-semibold">{formatDateTime(s.appointment_at)}</strong>
        </span>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
          <Pencil /> Change
        </Button>
      </div>
    );
  }

  function book() {
    setError(null);
    start(async () => {
      const r = await reviewReferral({ id: s.id, status: "scheduled", appointmentAt: when });
      if (r.error) return setError(r.error);
      onChange({ referral_status: "scheduled", appointment_at: new Date(`${when}:00+05:00`).toISOString(), reviewed_at: new Date().toISOString() });
      setEditing(false);
    });
  }

  return (
    <div className="space-y-1.5">
      {urgent && <p className="text-sm text-urgent">Book the earliest available slot. There may be a risk to sight.</p>}
      <Label htmlFor="appt" className="text-xs text-muted-foreground">
        Appointment (Pakistan time)
      </Label>
      <div className="flex gap-2">
        <Input id="appt" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 rounded-2xl bg-white/[0.05]" disabled={pending} />
        <Button className="h-11 shrink-0 px-6" disabled={pending} onClick={book}>
          {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />} Book
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
