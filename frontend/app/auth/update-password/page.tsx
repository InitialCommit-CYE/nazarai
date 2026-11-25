import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the password-recovery email (via /auth/confirm, which starts the session). */
export default function UpdatePasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Your reset link is valid for a short time. Pick a password you do not use elsewhere.">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
