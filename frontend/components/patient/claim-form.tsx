"use client";

import { Link2 } from "lucide-react";
import { useActionState } from "react";

import { claimRecord } from "@/app/my/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";

export function ClaimForm() {
  const [state, action] = useActionState(claimRecord, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage error={state.error} />
      <Field id="code" label="Access code">
        <Input
          id="code"
          name="code"
          required
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          placeholder="K7MP2QXA"
          className="h-12 text-center font-mono text-xl tracking-[0.3em] uppercase"
        />
      </Field>
      <Field id="birthYear" label="Your birth year">
        <Input id="birthYear" name="birthYear" required inputMode="numeric" maxLength={4} placeholder="e.g. 1968" className="h-10" />
      </Field>
      <SubmitButton pendingText="Linking…">
        <Link2 /> Link my record
      </SubmitButton>
    </form>
  );
}
