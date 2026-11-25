import { z } from "zod";

const thisYear = () => new Date().getUTCFullYear();

const optionalYear = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1900 && v <= thisYear()), "Enter a valid year.");

/** Mirrors the database constraints on public.patients (the database is still the final check). */
export const PatientInput = z
  .object({
    fullName: z.string().trim().min(2, "Enter the patient's full name.").max(100, "Use at most 100 characters."),
    mrn: z
      .string()
      .trim()
      .min(1, "Enter the clinic reference number.")
      .max(40, "Use at most 40 characters.")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only."),
    birthYear: z
      .string()
      .trim()
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v >= 1900 && v <= thisYear(), "Enter a valid birth year."),
    sex: z.enum(["female", "male", "other", ""]).transform((v) => (v === "" ? null : v)),
    diabetesType: z.enum(["type1", "type2", "gestational", "other", "unknown"]),
    diabetesSinceYear: optionalYear,
    phone: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number, e.g. +92 300 1234567."),
  })
  .refine((v) => v.diabetesSinceYear === null || v.diabetesSinceYear >= v.birthYear, {
    message: "Diabetes cannot start before the birth year.",
    path: ["diabetesSinceYear"],
  });

export type PatientFieldName = "fullName" | "mrn" | "birthYear" | "sex" | "diabetesType" | "diabetesSinceYear" | "phone";

export const DIABETES_LABEL: Record<string, string> = {
  type1: "Type 1",
  type2: "Type 2",
  gestational: "Gestational",
  other: "Other",
  unknown: "Unknown",
};

export const SEX_LABEL: Record<string, string> = { female: "Female", male: "Male", other: "Other" };

/** Search input → safe PostgREST filter value (letters, digits, space, - and _ only). */
export function cleanSearch(q: unknown): string {
  return typeof q === "string" ? q.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 50) : "";
}
