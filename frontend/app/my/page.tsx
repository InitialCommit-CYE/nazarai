import { CalendarCheck, CheckCircle2, Download, FileText, Link2, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SafetyDisclaimer } from "@/components/clinical/notices";
import { ReferralBadge } from "@/components/clinical/referral-badge";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/site/page-bits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { URGENCY_INFO } from "@/lib/clinical";
import { formatDate, formatDateTime, greetingName } from "@/lib/format";
import { requireViewer } from "@/lib/server/auth";
import type { ReferralStatus, Urgency } from "@/lib/types";

export const metadata: Metadata = { title: "My results" };

type Result = {
  id: string;
  created_at: string;
  grade_label: string;
  urgency: Urgency;
  referral_status: ReferralStatus;
  appointment_at: string | null;
  specialist_note: string | null;
  patients: { clinics: { name: string } | null } | null;
};

export default function MyPage(props: PageProps<"/my">) {
  return (
    <PageContainer className="max-w-4xl">
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <MyResults searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function MyResults({ searchParams }: { searchParams: PageProps<"/my">["searchParams"] }) {
  const { viewer, db } = await requireViewer({ next: "/my", roles: ["patient"] });
  const [{ data: records }, { data }, sp] = await Promise.all([
    db.from("patients").select("id"),
    db
      .from("screenings")
      .select("id, created_at, grade_label, urgency, referral_status, appointment_at, specialist_note, patients(clinics(name))")
      .eq("quality_ok", true)
      .order("created_at", { ascending: false })
      .limit(30),
    searchParams,
  ]);
  const results = (data ?? []) as unknown as Result[];
  const upcoming = results.filter((r) => r.referral_status === "scheduled" && r.appointment_at && new Date(r.appointment_at) > new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Patient"
        title={`Hello${greetingName(viewer.fullName) ? `, ${greetingName(viewer.fullName)}` : ""}`}
        description="Your retinal screening results and eye specialist appointments."
        actions={
          <Button asChild variant="outline" size="lg" className="h-9 px-3">
            <Link href="/my/link">
              <Link2 /> Link another record
            </Link>
          </Button>
        }
      />
      {sp.linked && (
        <Alert className="border-routine/30 bg-routine-soft" role="status">
          <CheckCircle2 className="text-routine" />
          <AlertDescription className="text-foreground">Your clinic record is now linked to this account.</AlertDescription>
        </Alert>
      )}

      {(records ?? []).length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Link your clinic record"
          description="Enter the access code from your clinic to see your results here."
          action={
            <Button asChild>
              <Link href="/my/link">Enter access code</Link>
            </Button>
          }
        />
      ) : (
        <>
          {upcoming.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border border-brand-blue/25 bg-accent p-4">
              <CalendarCheck className="mt-0.5 size-5 shrink-0 text-accent-foreground" />
              <div>
                <p className="font-medium">Eye specialist appointment</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(r.appointment_at!)}
                  {r.patients?.clinics?.name ? ` · arranged by ${r.patients.clinics.name}` : ""}
                </p>
              </div>
            </div>
          ))}
          {results.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No results yet" description="Your results appear here after your clinic screens your eyes." />
          ) : (
            <div className="space-y-4">
              {results.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">Screening on {formatDate(r.created_at)}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{r.patients?.clinics?.name}</p>
                    </div>
                    <ReferralBadge urgency={r.urgency} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">
                      <span className="text-muted-foreground">AI screening result: </span>
                      <span className="font-medium">{r.grade_label}</span>. {URGENCY_INFO[r.urgency].action.en}
                    </p>
                    {r.specialist_note && (
                      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">Note from your eye specialist</p>
                        <p className="mt-1 whitespace-pre-wrap">{r.specialist_note}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="lg" className="h-9 px-3">
                        <Link href={`/screenings/${r.id}/report`}>
                          <FileText /> Read report (English / اردو)
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg" className="h-9 px-3">
                        <a href={`/api/reports/${r.id}/pdf?lang=en`} download>
                          <Download /> PDF
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <SafetyDisclaimer />
    </div>
  );
}
