import type { Metadata } from "next";
import { Suspense } from "react";

import { ScreeningWorkspace } from "@/components/screening/screening-workspace";
import type { PickedPatient } from "@/components/screening/patient-picker";
import { PageContainer, PageHeader } from "@/components/site/page-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";
import { UUID_RE } from "@/lib/server/http";

export const metadata: Metadata = { title: "Screen a patient" };

export default function ScreenPage(props: PageProps<"/screen">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Screening"
        title="Screen a retina photo"
        description="The image is checked for quality, graded on the International Clinical DR scale, explained with Grad-CAM, and then deleted. Only the result is saved to the patient's record."
      />
      <Suspense fallback={<WorkspaceSkeleton />}>
        <Workspace searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Workspace({ searchParams }: { searchParams: PageProps<"/screen">["searchParams"] }) {
  const sp = await searchParams;
  const pid = typeof sp.patient === "string" && UUID_RE.test(sp.patient) ? sp.patient : null;
  const { db } = await requireViewer({ next: pid ? `/screen?patient=${pid}` : "/screen", roles: CLINICAL_ROLES });
  let initial: PickedPatient | null = null;
  if (pid) {
    const { data } = await db.from("patients").select("id, full_name, mrn, birth_year").eq("id", pid).maybeSingle<PickedPatient>();
    initial = data ?? null;
  }
  return <ScreeningWorkspace key={pid ?? "none"} initialPatient={initial} />;
}

function WorkspaceSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]" aria-busy="true">
      <Skeleton className="h-[480px] rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    </div>
  );
}
