"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/app/auth/actions";
import { ArrowChip, arrowPillClasses } from "@/components/ui/arrow-link";
import { Input } from "@/components/ui/input";
import { demoSlug } from "@/lib/demo";
import { cn } from "@/lib/utils";

import { Field, FormMessage, PasswordInput, SubmitButton } from "./form-bits";

const initial: FormState = {};

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

const DEMO_HINT: Record<string, string> = {
  "health-worker": "Screens patients, sends referrals",
  "eye-specialist": "Reviews referrals, urgent first",
  patient: "Sees own results and report",
};

/** Same rules as the server: same-site relative paths only, never back into /auth. */
function safeNext(next?: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/auth")) return null;
  return next;
}

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
  const auto = autoDemo ? demo.find((a) => demoSlug(a.role) === autoDemo) : undefined;

  useEffect(() => {
    if (!auto || autoTried.current) return;
    autoTried.current = true;
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = auto.email;
    (f.elements.namedItem("password") as HTMLInputElement).value = auto.password;
    f.requestSubmit();
  }, [auto]);

  // The shared demo accounts come first: almost everyone who opens this page is here to try the demo.
  const oneClick = demo.filter((a) => a.role.toLowerCase() !== "patient");
  const back = safeNext(next);

  return (
    <div className="space-y-7">
      {auto && !state.error && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Opening the demo clinic as {auto.role.toLowerCase()}
        </p>
      )}
      {oneClick.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Try the demo clinic</p>
          <div className="grid gap-2.5">
            {oneClick.map((a, i) => {
              const slug = demoSlug(a.role);
              const tone = i === 0 ? "light" : "dark";
              return (
                // A plain link, never next/link: the one-click route must not be prefetched.
                <a
                  key={a.email}
                  href={`/auth/demo?as=${slug}${back ? `&next=${encodeURIComponent(back)}` : ""}`}
                  className={arrowPillClasses(tone, "min-h-14 w-full")}
                >
                  <span className="flex flex-col text-start leading-snug">
                    <span>Continue as {a.role.toLowerCase()}</span>
                    {DEMO_HINT[slug] && <span className={cn("text-xs font-normal", tone === "light" ? "text-black/60" : "text-muted-foreground")}>{DEMO_HINT[slug]}</span>}
                  </span>
                  <ArrowChip tone={tone} />
                </a>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">One click, no sign-up. Synthetic patients only: never enter real patient data.</p>
        </div>
      )}

      {oneClick.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or sign in with your account</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

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
        <SubmitButton pendingText="Signing in…" variant="outline">
          <LogIn /> Sign in
        </SubmitButton>
      </form>
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
