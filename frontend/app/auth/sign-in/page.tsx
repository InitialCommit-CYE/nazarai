import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm, type DemoAccount } from "@/components/auth/auth-forms";
import { FormSkeleton } from "@/components/site/page-bits";
import { homeFor } from "@/lib/roles";
import { getViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, { error?: string; ok?: string }> = {
  inactive: { error: "This account has been deactivated. Contact your clinic administrator." },
  link: { error: "That link is invalid or has expired. Please request a new one." },
};

/** Demo-clinic logins (synthetic data only), configured server-side: DEMO_ACCOUNTS="Role|email|password;…" */
function demoAccounts(): DemoAccount[] {
  return (process.env.DEMO_ACCOUNTS ?? "")
    .split(";")
    .map((s) => s.split("|"))
    .filter((p) => p.length === 3 && p.every(Boolean))
    .map(([role, email, password]) => ({ role, email, password }));
}

export default function SignInPage(props: PageProps<"/auth/sign-in">) {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Clinic staff and patients use the same sign-in. You will land on the page for your role."
      footer={
        <>
          Patient without an account?{" "}
          <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
            Create one
          </Link>
          . Staff accounts are created by your clinic administrator.
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <SignInContent searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignInContent({ searchParams }: { searchParams: PageProps<"/auth/sign-in">["searchParams"] }) {
  const viewer = await getViewer();
  if (viewer?.active) redirect(homeFor(viewer.role));
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const errorKey = typeof sp.error === "string" ? sp.error : "";
  const notice = sp.signed_out ? { ok: "You have been signed out." } : NOTICES[errorKey];
  return <SignInForm next={next} notice={notice} demo={demoAccounts()} />;
}
