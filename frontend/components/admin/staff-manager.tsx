"use client";

import { Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { createStaff, resetStaffPassword, updateMember, type CreateStaffState } from "@/app/admin/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";

export interface StaffMember {
  id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  must_change_password: boolean;
}

function Credential({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-xl border border-primary/30 bg-secondary p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Email: </span>
          <span className="font-medium">{email}</span>
        </p>
        <p className="flex items-center justify-between gap-2">
          <span>
            <span className="text-muted-foreground">Temporary password: </span>
            <span className="font-mono font-semibold">{password}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy temporary password"
            onClick={async () => {
              await navigator.clipboard.writeText(password).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? <Check className="text-routine" /> : <Copy />}
          </Button>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Share it privately (in person or by phone). It is shown only once and must be changed at first sign-in.
      </p>
    </div>
  );
}

export function CreateStaffForm() {
  const [state, action] = useActionState<CreateStaffState, FormData>(createStaff, {});
  const [formKey, setFormKey] = useState(0);
  if (state.created) {
    return (
      <div className="space-y-4">
        <FormMessage ok={`Account created for ${state.created.name}.`} />
        <Credential email={state.created.email} password={state.created.password} />
        <Button variant="outline" className="h-9 w-full" onClick={() => setFormKey((k) => k + 1)}>
          <UserPlus /> Add another
        </Button>
      </div>
    );
  }
  return (
    <form key={formKey} action={action} className="space-y-4" noValidate>
      <FormMessage error={state.error} />
      <Field id="fullName" label="Full name">
        <Input id="fullName" name="fullName" required maxLength={100} className="h-10" defaultValue={state.values?.fullName} />
      </Field>
      <Field id="email" label="Work email">
        <Input id="email" name="email" type="email" required className="h-10" defaultValue={state.values?.email} />
      </Field>
      <Field id="role" label="Role">
        <NativeSelect id="role" name="role" defaultValue={state.values?.role ?? "operator"} className="h-10">
          <option value="operator">{ROLE_LABEL.operator}: screens patients</option>
          <option value="specialist">{ROLE_LABEL.specialist}: reviews referrals</option>
          <option value="admin">{ROLE_LABEL.admin}: manages staff</option>
        </NativeSelect>
      </Field>
      <SubmitButton pendingText="Creating account…">
        <UserPlus /> Create account
      </SubmitButton>
    </form>
  );
}

export function StaffRow({ member, isSelf }: { member: StaffMember; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.is_active);

  function save(nextRole: AppRole, nextActive: boolean) {
    const prev = { role, active };
    setRole(nextRole);
    setActive(nextActive);
    setError(null);
    start(async () => {
      const r = await updateMember(member.id, nextRole, nextActive);
      if (r.error) {
        setRole(prev.role);
        setActive(prev.active);
        setError(r.error);
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.full_name || member.email}
          {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        {member.must_change_password && <p className="mt-0.5 text-xs text-[oklch(0.45_0.12_60)]">Has not set their own password yet</p>}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
        <NativeSelect
          aria-label={`Role of ${member.full_name || member.email}`}
          value={role}
          disabled={isSelf || pending}
          onChange={(e) => save(e.target.value as AppRole, active)}
          className="h-9 w-40"
        >
          <option value="operator">{ROLE_LABEL.operator}</option>
          <option value="specialist">{ROLE_LABEL.specialist}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} disabled={isSelf || pending} onCheckedChange={(v) => save(role, v)} aria-label={`Account active for ${member.full_name || member.email}`} />
          <span className={active ? "" : "text-muted-foreground"}>{active ? "Active" : "Deactivated"}</span>
        </label>
        {!isSelf && <ResetPasswordButton id={member.id} email={member.email ?? ""} />}
      </div>
    </li>
  );
}

function ResetPasswordButton({ id, email }: { id: string; email: string }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog onOpenChange={(o) => !o && (setPassword(null), setError(null))}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-9 px-3" aria-label={`Reset password for ${email}`}>
          <KeyRound /> <span className="hidden lg:inline">Reset password</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset password for {email}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their current password stops working immediately. You will get a temporary password to pass on; they must
            change it when they next sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {password ? <Credential email={email} password={password} /> : error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{password ? "Done" : "Cancel"}</AlertDialogCancel>
          {!password && (
            <Button
              size="lg"
              className="px-4"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await resetStaffPassword(id);
                  if (r.password) setPassword(r.password);
                  else setError(r.error ?? "Something went wrong.");
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Reset password
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
