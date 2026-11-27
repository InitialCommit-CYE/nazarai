import Link from "next/link";

import type { PatientSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DIABETES_LABEL, SEX_LABEL } from "@/lib/validation/patient";

/** "45 y · Female · Type 2 diabetes, 8 y" — the identity line clinicians read before acting. */
export function patientFacts(p: Pick<PatientSummary, "birth_year" | "sex" | "diabetes_type" | "diabetes_since_year">, year = new Date().getFullYear()) {
  const facts = [`${Math.max(0, year - p.birth_year)} y`];
  if (p.sex) facts.push(SEX_LABEL[p.sex]);
  const dm = `${DIABETES_LABEL[p.diabetes_type]} diabetes`;
  facts.push(p.diabetes_since_year ? `${dm}, ${Math.max(0, year - p.diabetes_since_year)} y` : dm);
  return facts;
}

/**
 * Patient identity bar, pinned above clinical content (the hospital-record convention that guards
 * against acting on the wrong patient). Name, MR number, age, sex, diabetes.
 */
export function PatientBanner({ patient, href, actions, className }: {
  patient: PatientSummary;
  href?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const name = href ? (
    <Link href={href} className="hover:underline">
      {patient.full_name}
    </Link>
  ) : (
    patient.full_name
  );
  return (
    <section
      aria-label="Patient"
      className={cn("flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/[0.07] bg-surface px-5 py-4", className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-extrabold text-background" aria-hidden>
          {initialsOf(patient.full_name)}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="truncate text-lg font-bold">{name}</span>
            <span className="font-mono text-xs text-muted-foreground">MR {patient.mrn}</span>
          </p>
          <p className="text-sm text-muted-foreground">{patientFacts(patient).join(" · ")}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
