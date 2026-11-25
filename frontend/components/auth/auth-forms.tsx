"use client";

import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef } from "react";

import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";

import { Field, FormMessage, PasswordInput, SubmitButton } from "./form-bits";

const initial: FormState = {};

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

export function SignInForm({ next, notice, demo }: { next?: string; notice?: { error?: string; ok?: string }; demo: DemoAccount[] }) {
  const [state, action] = useActionState(signIn, initial);
  const formRef = useRef<HTMLFormElement>(null);

  function fill(a: DemoAccount) {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = a.email;
    (f.elements.namedItem("password") as HTMLInputElement).value = a.password;
    f.requestSubmit();
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <FormMessage error={state.error ?? notice?.error} ok={state.error ? undefined : notice?.ok} />
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" defaultValue={state.fields?.email} />
        </Field>
        <Field
          id="password"
          label="Password"
          action={
            <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput id="password" name="password" autoComplete="current-password" />
        </Field>
        <SubmitButton pendingText="Signing in…">
          <LogIn /> Sign in
        </SubmitButton>
      </form>

      {demo.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
          <p className="text-sm font-medium">Demo clinic (synthetic data only)</p>
          <p className="mt-1 text-xs text-muted-foreground">Sign in as a role to explore the workflow. Never enter real patient data.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {demo.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <UserRound className="size-4 text-primary" />
                <span className="font-medium">{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  if (state.ok) return <FormMessage ok={state.ok} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage error={state.error} />
      <Field id="fullName" label="Full name">
        <Input id="fullName" name="fullName" autoComplete="name" required maxLength={100} className="h-10" defaultValue={state.fields?.fullName} />
      </Field>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" defaultValue={state.fields?.email} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span className="text-muted-foreground">
          I understand NazarAI shows AI screening results, not a diagnosis, and that my clinic shares my results with me
          through this account. <Link href="/about#privacy" className="font-medium text-primary hover:underline">Privacy notice</Link>
        </span>
      </label>
      <SubmitButton pendingText="Creating account…">Create patient account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage error={state.error} ok={state.ok} />
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" defaultValue={state.fields?.email} />
      </Field>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm({ returnTo }: { returnTo?: "settings" }) {
  const [state, action] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {returnTo && <input type="hidden" name="return" value={returnTo} />}
      <FormMessage error={state.error} ok={state.ok} />
      <Field id="password" label="New password" hint="At least 10 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
