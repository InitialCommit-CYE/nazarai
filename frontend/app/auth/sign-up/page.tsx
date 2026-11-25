import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create a patient account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create a patient account"
      subtitle="See your retinal screening results and specialist appointments. After confirming your email, link your record with the code on your referral slip."
      footer={
        <>
          Already registered?{" "}
          <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
