import type { Metadata } from "next";

import { Suspense } from "react";

import { ClinicQueue } from "@/components/queue/clinic-queue";
import { TableSkeleton } from "@/components/site/page-bits";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Referrals" };

export default function QueuePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow text-primary">Clinic worklist</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Referrals and screenings</h1>
        <p className="mt-2 text-muted-foreground">
          Your clinic&apos;s screenings, urgent referrals first. Open a result to book the specialist appointment or record the outcome. Updates live.
        </p>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <Guard />
      </Suspense>
    </div>
  );
}

async function Guard() {
  await requireViewer({ next: "/queue", roles: CLINICAL_ROLES });
  return <ClinicQueue />;
}
