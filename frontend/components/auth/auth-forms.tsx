"use client";

import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";

import { Field, FormMessage, PasswordInput, SubmitButton } from "./form-bits";

const initial: FormState = {};

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

/** "Health worker" -> "health-worker": the value used in /auth/sign-in?demo=… one-click links. */
export function demoSlug(role: string): string {
  return role.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const DEMO_HINT: Record<string, string> = {
  "health-worker": "Screens patients, sends referrals",
  "eye-specialist": "Reviews referrals, urgent first",
  patient: "Sees own results and report",
};

export function SignInForm({ next, notice, demo, autoDemo }: {
  next?: string;
  notice?: { error?: string; ok?: string };
  demo: DemoAccount[];
  /** Slug of a demo account to sign in as immediately (one-click "Try the demo" links). */
  autoDemo?: string;
}) {
  const [state, action] = useActionState(signIn, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (!autoDemo || autoTried.current) return;
    const account = demo.find((a) => demoSlug(a.role) === autoDemo);
    if (!account) return;
    autoTried.current = true;
    fill(account);
  }, [autoDemo, demo]);

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
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono tracking-wider uppercase">or try the demo clinic</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-2">
            {demo.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a)}
                className="group flex items-center gap-3 rounded-md border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <UserRound className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Continue as {a.role.toLowerCase()}</span>
                  {DEMO_HINT[demoSlug(a.role)] && (
                    <span className="block text-xs text-muted-foreground">{DEMO_HINT[demoSlug(a.role)]}</span>
                  )}
                </span>
                <LogIn className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">One click, no sign-up. Synthetic patients only: never enter real patient data.</p>
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
