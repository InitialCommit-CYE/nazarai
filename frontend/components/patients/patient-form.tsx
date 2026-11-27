"use client";

import { Loader2, Save, ScanEye } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { PatientFormState } from "@/app/patients/actions";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { PatientFieldName } from "@/lib/validation/patient";

export interface PatientDefaults {
  fullName: string;
  mrn: string;
  birthYear: string;
  sex: string;
  diabetesType: string;
  diabetesSinceYear: string;
  phone: string;
}

type Action = (prev: PatientFormState, form: FormData) => Promise<PatientFormState>;

export function PatientRecordForm({ action, defaults, mode, cancelHref }: {
  action: Action;
  defaults: PatientDefaults;
  mode: "create" | "edit";
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = (k: keyof PatientDefaults) => state.values?.[k] ?? defaults[k];
  const err = (k: PatientFieldName) => state.fieldErrors?.[k];
  const year = new Date().getFullYear();

  const field = (k: PatientFieldName, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {input}
      {err(k) ? (
        <p id={`${k}-error`} className="text-xs text-destructive">
          {err(k)}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
  const a11y = (k: PatientFieldName) => ({ "aria-invalid": Boolean(err(k)) || undefined, "aria-describedby": err(k) ? `${k}-error` : undefined });

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <FormMessage error={state.error} />

      <section className="space-y-4">
        <h2 className="text-base font-medium text-foreground">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("fullName", "Full name", <Input id="fullName" name="fullName" required maxLength={100} autoComplete="off" defaultValue={v("fullName")} key={`n${v("fullName")}`} className="h-10" {...a11y("fullName")} />)}
          {field(
            "mrn",
            "Clinic reference (MRN)",
            <Input id="mrn" name="mrn" required maxLength={40} autoComplete="off" defaultValue={v("mrn")} key={`m${v("mrn")}`} className="h-10 font-mono" {...a11y("mrn")} />,
            "Unique within your clinic. Letters, numbers, - and _.",
          )}
          {field("birthYear", "Birth year", <Input id="birthYear" name="birthYear" required inputMode="numeric" placeholder="e.g. 1968" defaultValue={v("birthYear")} key={`b${v("birthYear")}`} className="h-10" min={1900} max={year} {...a11y("birthYear")} />)}
          {field(
            "sex",
            "Sex",
            <NativeSelect id="sex" name="sex" defaultValue={v("sex")} key={`s${v("sex")}`} className="h-10" {...a11y("sex")}>
              <option value="">Prefer not to record</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </NativeSelect>,
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-medium text-foreground">Diabetes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "diabetesType",
            "Type",
            <NativeSelect id="diabetesType" name="diabetesType" defaultValue={v("diabetesType") || "type2"} key={`t${v("diabetesType")}`} className="h-10">
              <option value="type2">Type 2</option>
              <option value="type1">Type 1</option>
              <option value="gestational">Gestational</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </NativeSelect>,
          )}
          {field(
            "diabetesSinceYear",
            "Diagnosed in (year)",
            <Input id="diabetesSinceYear" name="diabetesSinceYear" inputMode="numeric" placeholder="Optional" defaultValue={v("diabetesSinceYear")} key={`d${v("diabetesSinceYear")}`} className="h-10" {...a11y("diabetesSinceYear")} />,
            "Used to show years with diabetes on reports.",
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-medium text-foreground">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "phone",
            "Phone (optional)",
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+92 300 1234567" defaultValue={v("phone")} key={`p${v("phone")}`} className="h-10" {...a11y("phone")} />,
            "Only for follow-up about referrals.",
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" size="lg" className="h-10 px-4">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        {mode === "create" && (
          <SubmitButton pendingText="Saving…" variant="outline" className="sm:w-auto sm:px-4">
            <Save /> Save patient
          </SubmitButton>
        )}
        {mode === "create" ? (
          <SaveAndScreenButton />
        ) : (
          <SubmitButton pendingText="Saving…" className="sm:w-auto sm:px-4">
            <Save /> Save changes
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

function SaveAndScreenButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="then" value="screen" size="lg" className="h-10 px-4" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <ScanEye />} Save and screen
    </Button>
  );
}
