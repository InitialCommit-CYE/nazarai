import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Pagination, ParamSelect } from "@/components/site/list-controls";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/site/page-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { actionLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 30;
const ENTITIES = [
  { value: "all", label: "All activity" },
  { value: "patient", label: "Patient records" },
  { value: "screening", label: "Screenings & referrals" },
  { value: "profile", label: "Staff accounts" },
];
const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function AuditPage(props: PageProps<"/admin/audit">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Who opened, created, changed or deleted records in your clinic. Entries cannot be edited or deleted, and contain no patient details."
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Suspense fallback={<div className="h-9" />}>
          <ParamSelect name="entity" label="Show" defaultValue="all" options={ENTITIES} />
          <ParamSelect name="days" label="Period" defaultValue="30" options={RANGES} />
        </Suspense>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <AuditTable searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function AuditTable({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const { db } = await requireViewer({ next: "/admin/audit", roles: ["admin"] });
  const sp = await searchParams;
  const entity = ENTITIES.some((e) => e.value === sp.entity) && sp.entity !== "all" ? (sp.entity as string) : null;
  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let q = db
    .from("audit_log")
    .select("id, at, actor_id, action, entity, entity_id", { count: "exact" })
    .gte("at", since)
    .order("at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) q = q.eq("entity", entity);
  const [{ data, count, error }, { data: staff }] = await Promise.all([q, db.from("profiles").select("id, full_name, email")]);
  if (error) throw new Error("Could not load the audit log.");
  const names = new Map((staff ?? []).map((s) => [s.id as string, (s.full_name as string) || (s.email as string)]));
  const rows = data ?? [];

  if (!rows.length) return <EmptyState icon={ScrollText} title="No activity in this period" description="Try a longer period or a different filter." />;

  const params = Object.fromEntries(Object.entries({ entity: entity ?? "", days: days === 30 ? "" : String(days) }).filter(([, v]) => v));
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
              <TableHead className="pr-4">Record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id as number}>
                <TableCell className="pl-4 whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(r.at as string)}</TableCell>
                <TableCell className="font-medium">{names.get(r.actor_id as string) ?? (r.actor_id ? "Patient / former staff" : "System")}</TableCell>
                <TableCell>{actionLabel(r.action as string)}</TableCell>
                <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                  {r.entity as string}
                  {r.entity_id ? ` · ${(r.entity_id as string).slice(0, 8)}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} basePath="/admin/audit" params={params} />
    </>
  );
}
