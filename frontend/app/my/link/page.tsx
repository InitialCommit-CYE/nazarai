import type { Metadata } from "next";
import { Suspense } from "react";

import { ClaimForm } from "@/components/patient/claim-form";
import { FormSkeleton, PageContainer, PageHeader } from "@/components/site/page-bits";
import { Card, CardContent } from "@/components/ui/card";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Link your clinic record" };

export default function LinkPage() {
  return (
    <PageContainer className="max-w-xl">
      <PageHeader
        eyebrow="Patient"
        title="Link your clinic record"
        description="Your clinic gives you an 8-character access code, printed on your referral slip or read out to you. Enter it with your birth year."
      />
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<FormSkeleton />}>
            <Guard />
          </Suspense>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        For your safety, a code works only once, expires after 14 days, and only 5 attempts are allowed per hour.
      </p>
    </PageContainer>
  );
}

async function Guard() {
  await requireViewer({ next: "/my/link", roles: ["patient"] });
  return <ClaimForm />;
}
