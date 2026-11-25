import { ArrowLeft, CheckCircle2, ChevronRight, Link2, Pencil, ScanEye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReferralBadge } from "@/components/clinical/referral-badge";
import { ReferralStatusBadge } from "@/components/clinical/referral-status";
import { AccessCodeButton, DeletePatientButton } from "@/components/patients/patient-actions";
import { EmptyState, PageContainer, TableSkeleton } from "@/components/site/page-bits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";
import { UUID_RE } from "@/lib/server/http";
import type { ReferralStatus, Urgency } from "@/lib/types";
import { DIABETES_LABEL, SEX_LABEL } from "@/lib/validation/patient";

export const metadata: Metadata = { title: "Patient" };

interface Patient {
  id: string;
  mrn: string;
  full_name: string;
  birth_year: number;
  sex: string | null;
  diabetes_type: string;
  diabetes_since_year: number | null;
  phone: string | null;
  user_id: string | null;
  access_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScreeningRow {
  id: string;
  created_at: string;
  quality_ok: boolean;
  grade_label: string | null;
  urgency: Urgency | null;
  referral_status: ReferralStatus;
  appointment_at: string | null;
}

export default function PatientPage(props: PageProps<"/patients/[id]">) {
  return (
    <PageContainer>
      <Link href="/patients" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All patients
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <PatientDetail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function PatientDetail({ params, searchParams }: { params: PageProps<"/patients/[id]">["params"]; searchParams: PageProps<"/patients/[id]">["searchParams"] }) {
  const { id } = await params;
  const { db } = await requireViewer({ next: `/patients/${id}`, roles: CLINICAL_ROLES });
  if (!UUID_RE.test(id)) notFound();
  const [{ data: p }, { data: screenings }, sp] = await Promise.all([
    db
      .from("patients")
      .select("id, mrn, full_name, birth_year, sex, diabetes_type, diabetes_since_year, phone, user_id, access_code_expires_at, created_at, updated_at")
      .eq("id", id)
      .maybeSingle<Patient>(),
    db
      .from("screenings")
      .select("id, created_at, quality_ok, grade_label, urgency, referral_status, appointment_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    searchParams,
  ]);
  if (!p) notFound();
  await db.rpc("log_record_access", { p_entity: "patient", p_id: id });

  const year = new Date().getUTCFullYear();
  const rows = (screenings ?? []) as ScreeningRow[];
  const activeCode = Boolean(p.access_code_expires_at && new Date(p.access_code_expires_at) > new Date());
  const notice = sp.created ? "Patient registered." : sp.updated ? "Changes saved." : null;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert className="border-routine/30 bg-routine-soft" role="status">
          <CheckCircle2 className="text-routine" />
          <AlertDescription className="text-foreground">{notice}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{p.mrn}</p>
          <h1 className="font-display mt-2 text-3xl font-normal sm:text-4xl">{p.full_name}</h1>
          <p className="mt-1 text-muted-foreground">
            {year - p.birth_year} years{p.sex ? ` · ${SEX_LABEL[p.sex]}` : ""} · {DIABETES_LABEL[p.diabetes_type]} diabetes
            {p.diabetes_since_year ? ` for ${Math.max(0, year - p.diabetes_since_year)} years` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-9 px-3.5">
            <Link href={`/screen?patient=${p.id}`}>
              <ScanEye /> Screen patient
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-9 px-3">
            <Link href={`/patients/${p.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <AccessCodeButton id={p.id} linked={Boolean(p.user_id)} hasActiveCode={activeCode} />
          <DeletePatientButton id={p.id} name={p.full_name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Screening history</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {rows.length === 0 ? (
              <div className="px-6">
                <EmptyState
                  icon={ScanEye}
                  title="Not screened yet"
                  description="Run the first retinal screening for this patient."
                  action={
                    <Button asChild>
                      <Link href={`/screen?patient=${p.id}`}>
                        <ScanEye /> Screen now
                      </Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {rows.map((s) => {
                  const body = (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.quality_ok ? s.grade_label : "Image rejected: retake needed"}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.urgency && <ReferralBadge urgency={s.urgency} />}
                        {s.quality_ok && s.referral_status !== "not_required" && <ReferralStatusBadge status={s.referral_status} />}
                        {s.quality_ok && <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />}
                      </div>
                    </>
                  );
                  const cls = "flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between";
                  return (
                    <li key={s.id}>
                      {s.quality_ok ? (
                        <Link href={`/screenings/${s.id}`} className={`${cls} transition-colors hover:bg-muted/50`}>
                          {body}
                        </Link>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Record</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Birth year", String(p.birth_year)],
                ["Diabetes since", p.diabetes_since_year ? String(p.diabetes_since_year) : "Not recorded"],
                ["Phone", p.phone ?? "Not recorded"],
                ["Registered", formatDate(p.created_at)],
                ["Last updated", formatDate(p.updated_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">Patient account</dt>
                <dd className="text-right font-medium">
                  {p.user_id ? (
                    <span className="inline-flex items-center gap-1 text-routine">
                      <Link2 className="size-3.5" /> Linked
                    </span>
                  ) : activeCode ? (
                    "Code issued"
                  ) : (
                    "Not linked"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}
