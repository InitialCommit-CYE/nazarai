import { ArrowRight, ClipboardList, Plus, ScanEye, ScrollText, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReferralBadge } from "@/components/clinical/referral-badge";
import { ReferralStatusBadge } from "@/components/clinical/referral-status";
import { EmptyState, PageContainer, StatsSkeleton, TableSkeleton } from "@/components/site/page-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, greetingName, timeAgo } from "@/lib/format";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/roles";
import { requireViewer, type Viewer } from "@/lib/server/auth";
import { actionLabel } from "@/lib/audit-labels";
import type { ReferralStatus, Urgency } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

interface Stats {
  days: number;
  screenings: number;
  rejected: number;
  urgent: number;
  refer: number;
  routine: number;
  open_referrals: number;
  patients: number;
  staff: number;
}

export default function DashboardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </PageContainer>
  );
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function StatTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="border-b border-border py-5 sm:px-6 lg:border-b-0 lg:border-l lg:first:border-l-0 lg:first:pl-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-2 text-5xl tabular-nums">{compact.format(value)}</p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

async function Dashboard() {
  const { viewer, db } = await requireViewer({ next: "/dashboard", roles: STAFF_ROLES });
  const { data } = await db.rpc("clinic_stats", { p_days: 30 });
  const stats = (data ?? null) as Stats | null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Karachi" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = greetingName(viewer.fullName);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-primary">
            {ROLE_LABEL[viewer.role]}
            {viewer.clinicName ? ` · ${viewer.clinicName}` : ""}
          </p>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <QuickActions viewer={viewer} />
      </div>

      {stats ? (
        <section aria-label="Last 30 days">
          <div className="grid border-t border-foreground/80 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Screenings, last 30 days" value={stats.screenings} note={stats.rejected ? `${stats.rejected} needed a retake` : undefined} />
            <StatTile label="Referable results" value={stats.urgent + stats.refer} note={`${stats.urgent} urgent · ${stats.refer} routine referral`} />
            <StatTile label="Open referrals" value={stats.open_referrals} note="Awaiting or booked follow-up" />
            {viewer.role === "admin" ? (
              <StatTile label="Active staff" value={stats.staff} />
            ) : (
              <StatTile label="Registered patients" value={stats.patients} />
            )}
          </div>
        </section>
      ) : (
        <StatsSkeleton />
      )}

      {viewer.role === "admin" ? <AdminPanels /> : <ClinicalPanels viewer={viewer} />}
    </div>
  );
}

function QuickActions({ viewer }: { viewer: Viewer }) {
  if (viewer.role === "admin") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="h-9 px-3.5">
          <Link href="/admin/staff">
            <UsersRound /> Manage staff
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-9 px-3.5">
          <Link href="/admin/audit">
            <ScrollText /> Audit log
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="lg" className="h-9 px-3.5">
        <Link href="/screen">
          <ScanEye /> Screen a patient
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="h-9 px-3.5">
        <Link href="/patients/new">
          <Plus /> New patient
        </Link>
      </Button>
    </div>
  );
}

type WorkRow = {
  id: string;
  created_at: string;
  urgency: Urgency;
  referral_status: ReferralStatus;
  appointment_at: string | null;
  patients: { full_name: string; mrn: string } | null;
};

async function ClinicalPanels({ viewer }: { viewer: Viewer }) {
  const { db } = await requireViewer({ next: "/dashboard" });
  const [{ data: open }, { data: recent }] = await Promise.all([
    db
      .from("screenings")
      .select("id, created_at, urgency, referral_status, appointment_at, patients(full_name, mrn)")
      .in("referral_status", ["pending", "scheduled"])
      .order("urgency_rank")
      .order("created_at", { ascending: true })
      .limit(6),
    db
      .from("screenings")
      .select("id, created_at, urgency, referral_status, appointment_at, patients(full_name, mrn)")
      .eq("quality_ok", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const openRows = (open ?? []) as unknown as WorkRow[];
  const recentRows = (recent ?? []) as unknown as WorkRow[];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{viewer.role === "specialist" ? "Your referral worklist" : "Referrals needing follow-up"}</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/queue">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {openRows.length === 0 ? (
            <div className="px-6">
              <EmptyState icon={ShieldCheck} title="No open referrals" description="Referable screening results will appear here, urgent first." />
            </div>
          ) : (
            <WorkList rows={openRows} showStatus />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent screenings</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/patients">
              Patients <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {recentRows.length === 0 ? (
            <div className="px-6">
              <EmptyState
                icon={ScanEye}
                title="No screenings yet"
                description="Results will appear here as soon as the first photo is screened."
                action={
                  <Button asChild size="sm">
                    <Link href="/screen">Start screening</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <WorkList rows={recentRows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkList({ rows, showStatus }: { rows: WorkRow[]; showStatus?: boolean }) {
  return (
    <ul className="divide-y divide-border border-t border-border">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/screenings/${r.id}`} className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-muted/50">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.patients?.full_name ?? "Unknown patient"}</p>
              <p className="text-xs text-muted-foreground">
                {r.referral_status === "scheduled" && r.appointment_at
                  ? `Appointment ${formatDateTime(r.appointment_at)}`
                  : `Screened ${timeAgo(r.created_at)}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <ReferralBadge urgency={r.urgency} />
              {showStatus && <ReferralStatusBadge status={r.referral_status} className="hidden sm:inline-flex" />}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function AdminPanels() {
  const { db } = await requireViewer({ next: "/dashboard", roles: ["admin"] });
  const [{ data: staff }, { data: log }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, role, is_active").neq("role", "patient").order("role").limit(8),
    db.from("audit_log").select("id, at, action, actor_id").order("at", { ascending: false }).limit(8),
  ]);
  const names = new Map((staff ?? []).map((s) => [s.id as string, (s.full_name as string) || (s.email as string)]));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Staff</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/admin/staff">
              Manage <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border border-t border-border">
            {(staff ?? []).map((s) => (
              <li key={s.id as string} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{(s.full_name as string) || (s.email as string)}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email as string}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ROLE_LABEL[s.role as keyof typeof ROLE_LABEL]}
                  {!s.is_active && " · deactivated"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/admin/audit">
              Audit log <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {(log ?? []).length === 0 ? (
            <div className="px-6">
              <EmptyState icon={ClipboardList} title="No activity yet" />
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {(log ?? []).map((e) => (
                <li key={e.id as number} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{names.get(e.actor_id as string) ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{actionLabel(e.action as string)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.at as string)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-6 pt-3 text-xs text-muted-foreground">
            As clinic admin you see staff, totals and the audit trail, not patient identities or clinical details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      <StatsSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
