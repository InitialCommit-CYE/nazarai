"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isDemoEmail, isSeededDemoPatient } from "@/lib/demo";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireApiViewer } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/http";
import { PatientInput, type PatientFieldName } from "@/lib/validation/patient";

export interface PatientFormState {
  error?: string;
  fieldErrors?: Partial<Record<PatientFieldName, string>>;
  values?: Record<string, string>;
}

async function clinicalViewer() {
  try {
    return await requireApiViewer(CLINICAL_ROLES);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/auth/sign-in");
    throw e;
  }
}

function parse(form: FormData) {
  const values = Object.fromEntries(
    ["fullName", "mrn", "birthYear", "sex", "diabetesType", "diabetesSinceYear", "phone"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = PatientInput.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: PatientFormState["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] as PatientFieldName;
      fieldErrors[k] ??= i.message;
    }
    return { values, error: "Please correct the highlighted fields.", fieldErrors } as const;
  }
  return { values, data: parsed.data } as const;
}

/**
 * The shared demo accounts are public (one click on the landing page), so the five seeded patients that the
 * guide and every visitor rely on are read-only for them. New patients can still be edited and deleted.
 */
const DEMO_READ_ONLY = "This is one of the demo clinic's sample patients, kept the same for every visitor. Register a new patient to try editing or deleting.";

async function seededPatientLocked(db: Awaited<ReturnType<typeof clinicalViewer>>["db"], email: string, id: string): Promise<boolean> {
  if (!isDemoEmail(email)) return false;
  const { data } = await db.from("patients").select("mrn").eq("id", id).maybeSingle<{ mrn: string }>();
  return isSeededDemoPatient(data?.mrn);
}

function dbMessage(code: string | undefined): PatientFormState {
  if (code === "23505") return { error: "Another patient in your clinic already has this reference number.", fieldErrors: { mrn: "Already in use." } };
  if (code === "42501") return { error: "You do not have permission to do that." };
  return { error: "The record could not be saved. Please try again." };
}

export async function createPatient(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  const { viewer, db } = await clinicalViewer();
  const p = parse(form);
  if (!("data" in p)) return { values: p.values, error: p.error, fieldErrors: p.fieldErrors };
  const d = p.data!;
  const { data, error } = await db
    .from("patients")
    .insert({
      clinic_id: viewer.clinicId,
      created_by: viewer.id,
      full_name: d.fullName,
      mrn: d.mrn,
      birth_year: d.birthYear,
      sex: d.sex,
      diabetes_type: d.diabetesType,
      diabetes_since_year: d.diabetesSinceYear,
      phone: d.phone,
    })
    .select("id")
    .single();
  if (error || !data) return { values: p.values, ...dbMessage(error?.code) };
  revalidatePath("/patients");
  redirect(form.get("then") === "screen" ? `/screen?patient=${data.id}` : `/patients/${data.id}?created=1`);
}

export async function updatePatient(id: string, _prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  const { viewer, db } = await clinicalViewer();
  const p = parse(form);
  if (!("data" in p)) return { values: p.values, error: p.error, fieldErrors: p.fieldErrors };
  if (await seededPatientLocked(db, viewer.email, id)) return { values: p.values, error: DEMO_READ_ONLY };
  const d = p.data!;
  const { data, error } = await db
    .from("patients")
    .update({
      full_name: d.fullName,
      mrn: d.mrn,
      birth_year: d.birthYear,
      sex: d.sex,
      diabetes_type: d.diabetesType,
      diabetes_since_year: d.diabetesSinceYear,
      phone: d.phone,
    })
    .eq("id", id)
    .select("id");
  if (error) return { values: p.values, ...dbMessage(error.code) };
  if (!data?.length) return { values: p.values, error: "Patient not found in your clinic." };
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}?updated=1`);
}

export async function deletePatient(id: string): Promise<{ error?: string }> {
  const { viewer, db } = await clinicalViewer();
  if (await seededPatientLocked(db, viewer.email, id)) return { error: DEMO_READ_ONLY };
  const { data, error } = await db.from("patients").delete().eq("id", id).select("id");
  if (error) return dbMessage(error.code);
  if (!data?.length) return { error: "Patient not found in your clinic." };
  revalidatePath("/patients");
  redirect("/patients?deleted=1");
}

export async function issueAccessCode(id: string): Promise<{ code?: string; error?: string }> {
  const { db } = await clinicalViewer();
  const { data, error } = await db.rpc("issue_patient_access_code", { p_patient: id });
  if (error || typeof data !== "string") return { error: "Could not create an access code. Please try again." };
  revalidatePath(`/patients/${id}`);
  return { code: data };
}
