import { KeyRound, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { ProfileNameForm } from "@/components/settings/profile-name-form";
import { FormSkeleton, PageContainer, PageHeader } from "@/components/site/page-bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABEL } from "@/lib/roles";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Account settings" };

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader eyebrow="Account" title="Account settings" />
      <Suspense fallback={<FormSkeleton />}>
        <Settings />
      </Suspense>
    </PageContainer>
  );
}

async function Settings() {
  const { viewer } = await requireViewer({ next: "/settings", allowPasswordChange: true });
  return (
    <div className="space-y-6">
      {viewer.mustChangePassword && (
        <Alert className="rounded-[20px] border-white/10 bg-[#121418] p-4">
          <ShieldAlert className="text-refer" />
          <AlertTitle>Choose your own password to continue</AlertTitle>
          <AlertDescription>Your account was set up with a temporary password. Pick a new one before using NazarAI.</AlertDescription>
        </Alert>
      )}
      {!viewer.mustChangePassword && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              {viewer.email} · {ROLE_LABEL[viewer.role]}
              {viewer.clinicName ? ` at ${viewer.clinicName}` : ""}. Your role is managed by your clinic administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileNameForm defaultName={viewer.fullName} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Password
          </CardTitle>
          <CardDescription>At least 10 characters, with a letter and a number. Do not reuse a password from another site.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm">
          <UpdatePasswordForm returnTo={viewer.mustChangePassword ? undefined : "settings"} />
        </CardContent>
      </Card>
    </div>
  );
}
