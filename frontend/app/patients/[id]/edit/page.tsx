import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updatePatient } from "@/app/patients/actions";
import { PatientRecordForm } from "@/components/patients/patient-form";
import { FormSkeleton, PageContainer, PageHeader } from "@/components/site/page-bits";
import { Card, CardContent } from "@/components/ui/card";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";
import { UUID_RE } from "@/lib/server/http";

export const metadata: Metadata = { title: "Edit patient" };

export default function EditPatientPage(props: PageProps<"/patients/[id]/edit">) {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader eyebrow="Patients" title="Edit patient record" description="Changes are recorded in the clinic's audit log." />
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<FormSkeleton />}>
            <EditForm params={props.params} />
          </Suspense>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

async function EditForm({ params }: { params: PageProps<"/patients/[id]/edit">["params"] }) {
  const { id } = await params;
  const { db } = await requireViewer({ next: `/patients/${id}/edit`, roles: CLINICAL_ROLES });
  if (!UUID_RE.test(id)) notFound();
  const { data: p } = await db
    .from("patients")
    .select("id, full_name, mrn, birth_year, sex, diabetes_type, diabetes_since_year, phone")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  return (
    <PatientRecordForm
      action={updatePatient.bind(null, id)}
      mode="edit"
      cancelHref={`/patients/${id}`}
      defaults={{
        fullName: p.full_name,
        mrn: p.mrn,
        birthYear: String(p.birth_year),
        sex: p.sex ?? "",
        diabetesType: p.diabetes_type,
        diabetesSinceYear: p.diabetes_since_year ? String(p.diabetes_since_year) : "",
        phone: p.phone ?? "",
      }}
    />
  );
}
