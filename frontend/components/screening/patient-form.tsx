"use client";

import { Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PatientDraft {
  code: string;
  age: string;
  duration: string;
}

export function randomDemoCode() {
  return `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function patientErrors(p: PatientDraft): Partial<Record<keyof PatientDraft, string>> {
  const e: Partial<Record<keyof PatientDraft, string>> = {};
  if (p.code && !/^[A-Za-z0-9_-]{1,40}$/.test(p.code)) e.code = "Letters, numbers, - and _ only (max 40).";
  if (p.age && (!/^\d+$/.test(p.age) || +p.age < 18 || +p.age > 120)) e.age = "Adult age, 18–120.";
  if (p.duration && (!/^\d+$/.test(p.duration) || +p.duration > 80)) e.duration = "0–80 years.";
  if (p.age && p.duration && !e.age && !e.duration && +p.duration > +p.age) e.duration = "Cannot exceed age.";
  return e;
}

export function PatientForm({ value, onChange, disabled }: { value: PatientDraft; onChange: (v: PatientDraft) => void; disabled?: boolean }) {
  const errors = patientErrors(value);
  const field = (k: keyof PatientDraft) => ({
    value: value[k],
    disabled,
    "aria-invalid": Boolean(errors[k]) || undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value }),
  });

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="sr-only">Patient details (optional, synthetic demo data only)</legend>
      <div className="space-y-1.5">
        <Label htmlFor="code">Demo patient reference</Label>
        <div className="flex gap-2">
          <Input id="code" placeholder="DEMO-0042" autoComplete="off" maxLength={40} {...field("code")} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Generate a random demo reference"
            onClick={() => onChange({ ...value, code: randomDemoCode() })}
          >
            <Shuffle />
          </Button>
        </div>
        {errors.code ? (
          <p id="code-error" className="text-xs text-destructive">{errors.code}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Never enter a real name or ID: this demo stores synthetic references only.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="age">Age</Label>
          <Input id="age" inputMode="numeric" placeholder="e.g. 54" {...field("age")} />
          {errors.age && <p id="age-error" className="text-xs text-destructive">{errors.age}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration">Years with diabetes</Label>
          <Input id="duration" inputMode="numeric" placeholder="e.g. 9" {...field("duration")} />
          {errors.duration && <p id="duration-error" className="text-xs text-destructive">{errors.duration}</p>}
        </div>
      </div>
    </fieldset>
  );
}
