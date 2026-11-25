import { Link2, Plus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReferralBadge } from "@/components/clinical/referral-badge";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/site/page-bits";
import { Pagination, ParamSelect, SearchBox } from "@/components/site/list-controls";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";
import type { Urgency } from "@/lib/types";
import { cleanSearch, DIABETES_LABEL } from "@/lib/validation/patient";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 20;
const SORTS = {
  recent: { column: "created_at", ascending: false, label: "Newest first" },
  name: { column: "full_name", ascending: true, label: "Name A–Z" },
  mrn: { column: "mrn", ascending: true, label: "Reference" },
} as const;

type Row = { id: string; mrn: string; full_name: string; birth_year: number; diabetes_type: string; user_id: string | null; created_at: string };

export default function PatientsPage(props: PageProps<"/patients">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Clinic records"
        title="Patients"
        description="Everyone registered at your clinic. Only staff of your clinic can see these records."
        actions={
          <Button asChild size="lg" className="h-9 px-3.5">
            <Link href="/patients/new">
              <Plus /> New patient
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={<div className="h-9 w-full sm:max-w-xs" />}>
          <SearchBox placeholder="Search name or reference" label="Search patients" />
          <ParamSelect name="sort" label="Sort" defaultValue="recent" options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))} />
        </Suspense>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <PatientTable searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function PatientTable({ searchParams }: { searchParams: PageProps<"/patients">["searchParams"] }) {
  const { db } = await requireViewer({ next: "/patients", roles: CLINICAL_ROLES });
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const sortKey = (typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "recent") as keyof typeof SORTS;
  const sort = SORTS[sortKey];
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));

  let query = db
    .from("patients")
    .select("id, mrn, full_name, birth_year, diabetes_type, user_id, created_at", { count: "exact" })
    .order(sort.column, { ascending: sort.ascending })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike."%${q}%",mrn.ilike."%${q}%"`);
  const { data, count, error } = await query;
  if (error) throw new Error("Could not load patients.");
  const rows = (data ?? []) as Row[];

  // Latest screening per listed patient: ONE query for the page (no N+1).
  const latest = new Map<string, { urgency: Urgency | null; quality_ok: boolean; created_at: string }>();
  if (rows.length) {
    const { data: sc } = await db
      .from("patient_latest_screening")
      .select("patient_id, urgency, quality_ok, created_at")
      .in("patient_id", rows.map((r) => r.id));
    for (const s of (sc ?? []) as { patient_id: string; urgency: Urgency | null; quality_ok: boolean; created_at: string }[]) {
      latest.set(s.patient_id, s);
    }
  }

  if (!rows.length) {
    return q ? (
      <EmptyState title="No matching patients" description={`Nothing matches “${q}”. Check the spelling or search by reference number.`} />
    ) : (
      <EmptyState
        icon={UsersRound}
        title="No patients yet"
        description="Register a patient to start screening. You only need a name, reference number and birth year."
        action={
          <Button asChild>
            <Link href="/patients/new">
              <Plus /> Register the first patient
            </Link>
          </Button>
        }
      />
    );
  }

  const year = new Date().getUTCFullYear();
  const params = Object.fromEntries(Object.entries({ q, sort: sortKey === "recent" ? "" : sortKey }).filter(([, v]) => v));
  return (
    <>
      {/* Phones: cards. Larger screens: table. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => {
          const l = latest.get(r.id);
          return (
            <li key={r.id}>
              <Link href={`/patients/${r.id}`} className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.full_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.mrn}</p>
                  </div>
                  {l?.urgency ? <ReferralBadge urgency={l.urgency} /> : <span className="text-xs text-muted-foreground">Not screened</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {year - r.birth_year} yrs · {DIABETES_LABEL[r.diabetes_type]} · {l ? `last screened ${formatDate(l.created_at)}` : `registered ${formatDate(r.created_at)}`}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">Patient</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Diabetes</TableHead>
              <TableHead>Latest screening</TableHead>
              <TableHead className="pr-4 text-right">Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const l = latest.get(r.id);
              return (
                <TableRow key={r.id} className="group relative">
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/patients/${r.id}`} className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none">
                      {r.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.mrn}</TableCell>
                  <TableCell className="tabular-nums">{year - r.birth_year}</TableCell>
                  <TableCell>{DIABETES_LABEL[r.diabetes_type]}</TableCell>
                  <TableCell>
                    {l ? (
                      <span className="flex items-center gap-2">
                        {l.urgency ? <ReferralBadge urgency={l.urgency} /> : <span className="text-xs text-muted-foreground">Retake needed</span>}
                        <span className="text-xs text-muted-foreground">{formatDate(l.created_at)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not screened yet</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {r.user_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-routine">
                        <Link2 className="size-3.5" /> Linked
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} basePath="/patients" params={params} />
    </>
  );
}
