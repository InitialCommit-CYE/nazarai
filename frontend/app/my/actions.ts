"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireApiViewer } from "@/lib/server/auth";

export async function claimRecord(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { db } = await requireApiViewer(["patient"]);
  const p = z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/, "The code has 8 letters and numbers, e.g. K7MP2QXA."),
      birthYear: z.coerce.number().int().min(1900, "Enter your birth year.").max(new Date().getUTCFullYear(), "Enter your birth year."),
    })
    .safeParse({ code: String(form.get("code") ?? "").replace(/[\s-]/g, ""), birthYear: form.get("birthYear") });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { data, error } = await db.rpc("claim_patient_record", { p_code: p.data.code, p_birth_year: p.data.birthYear });
  if (error) return { error: "Something went wrong. Please try again." };
  if (data === "too_many_attempts") return { error: "Too many incorrect attempts. Please wait an hour, or ask your clinic for a new code." };
  if (data !== "linked") return { error: "That code and birth year do not match a record. Check the code on your slip, or ask your clinic for a new one." };
  redirect("/my?linked=1");
}
