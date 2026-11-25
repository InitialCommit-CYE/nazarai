import { Suspense } from "react";

import { ScreeningShell } from "@/components/results/screening-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/lib/server/auth";

function ShellFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export default function ScreeningLayout({ children, params }: LayoutProps<"/screenings/[id]">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: LayoutProps<"/screenings/[id]">["params"] }) {
  const { id } = await params;
  const { viewer, db } = await requireViewer({ next: `/screenings/${id}` });
  if (viewer.role !== "patient") await db.rpc("log_record_access", { p_entity: "screening", p_id: id });
  return <ScreeningShell role={viewer.role}>{children}</ScreeningShell>;
}
