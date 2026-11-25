import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateStaffForm, StaffRow, type StaffMember } from "@/components/admin/staff-manager";
import { FormSkeleton, PageContainer, PageHeader, TableSkeleton } from "@/components/site/page-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Staff accounts"
        description="Create accounts for your clinic's health workers and eye specialists, change roles, and deactivate access instantly."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
            <CardDescription>Deactivated staff lose access to all records immediately.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Suspense fallback={<div className="px-6"><TableSkeleton rows={4} /></div>}>
              <StaffList />
            </Suspense>
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Add a staff member</CardTitle>
            <CardDescription>You get a temporary password to hand over. No email provider needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<FormSkeleton />}>
              <AdminOnly>
                <CreateStaffForm />
              </AdminOnly>
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireViewer({ next: "/admin/staff", roles: ["admin"] });
  return children;
}

async function StaffList() {
  const { viewer, db } = await requireViewer({ next: "/admin/staff", roles: ["admin"] });
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role, is_active, must_change_password")
    .neq("role", "patient")
    .order("is_active", { ascending: false })
    .order("full_name");
  const staff = (data ?? []) as StaffMember[];
  return (
    <ul className="divide-y divide-border border-t border-border">
      {staff.map((m) => (
        <StaffRow key={m.id} member={m} isSelf={m.id === viewer.id} />
      ))}
    </ul>
  );
}
