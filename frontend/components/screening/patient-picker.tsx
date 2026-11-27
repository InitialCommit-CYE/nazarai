"use client";

import { Loader2, Plus, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { PatientSummary } from "@/lib/types";
import { cleanSearch } from "@/lib/validation/patient";

import { patientFacts } from "@/components/clinical/patient-banner";

export type PickedPatient = PatientSummary;

const COLUMNS = "id, full_name, mrn, sex, birth_year, diabetes_type, diabetes_since_year";

/** Search the clinic's patients (RLS-scoped browser query, debounced) or register a new one. */
export function PatientPicker({ value, onChange, disabled }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value) return;
    const term = cleanSearch(q);
    const t = setTimeout(async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      setLoading(true);
      let query = sb.from("patients").select(COLUMNS).order("created_at", { ascending: false }).limit(6);
      if (term) query = query.or(`full_name.ilike."%${term}%",mrn.ilike."%${term}%"`);
      const { data, error: err } = await query;
      setLoading(false);
      setError(err ? "Could not search patients." : null);
      setResults((data ?? []) as PickedPatient[]);
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, value]);

  const year = new Date().getFullYear();

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-secondary/60 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{value.full_name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{value.mrn}</span> · {year - value.birth_year} years
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => onChange(null)} disabled={disabled}>
          <X /> Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        {loading ? (
          <Loader2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or MR number"
          aria-label="Search patients"
          className="h-10 pl-9"
          disabled={disabled}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Patients">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onChange(p)}
              disabled={disabled}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.full_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{patientFacts(p).join(" · ")}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">MR {p.mrn}</span>
            </button>
          </li>
        ))}
        {!loading && results.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">{q ? "No matching patients." : "No patients registered yet."}</li>
        )}
      </ul>
      <Button asChild variant="outline" className="h-9 w-full">
        <Link href="/patients/new">
          <Plus /> Register a new patient
        </Link>
      </Button>
    </div>
  );
}
