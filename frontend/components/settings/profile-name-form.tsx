"use client";

import { useActionState } from "react";

import { updateProfileName } from "@/app/settings/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";

export function ProfileNameForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateProfileName, {});
  return (
    <form action={action} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field id="fullName" label="Display name">
          <Input id="fullName" name="fullName" defaultValue={defaultName} required maxLength={100} className="h-10" />
        </Field>
      </div>
      <SubmitButton pendingText="Saving…" className="sm:w-auto sm:px-4">
        Save
      </SubmitButton>
      <div className="sm:hidden">
        <FormMessage error={state.error} ok={state.ok} />
      </div>
      <span className="hidden text-sm sm:block" role="status">
        {state.error ? <span className="text-destructive">{state.error}</span> : state.ok && <span className="text-routine">{state.ok}</span>}
      </span>
    </form>
  );
}
