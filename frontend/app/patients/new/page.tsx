import type { Metadata } from "next";
import { Suspense } from "react";

import { createPatient } from "@/app/patients/actions";
import { PatientRecordForm } from "@/components/patients/patient-form";
import { FormSkeleton, PageContainer, PageHeader } from "@/components/site/page-bits";
import { Card, CardContent } from "@/components/ui/card";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "New patient" };

export default function NewPatientPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="Patients"
        title="Register a patient"
        description="Record only what is needed for screening and follow-up. The record is visible to staff of your clinic only."
      />
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<FormSkeleton />}>
            <NewPatientForm />
          </Suspense>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

async function NewPatientForm() {
  await requireViewer({ next: "/patients/new", roles: CLINICAL_ROLES });
  const suggested = `P-${new Date().getUTCFullYear().toString().slice(2)}${Math.floor(1000 + Math.random() * 9000)}`;
  return (
    <PatientRecordForm
      action={createPatient}
      mode="create"
      cancelHref="/patients"
      defaults={{ fullName: "", mrn: suggested, birthYear: "", sex: "", diabetesType: "type2", diabetesSinceYear: "", phone: "" }}
    />
  );
}
