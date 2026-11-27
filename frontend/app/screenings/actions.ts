"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CLINICAL_ROLES } from "@/lib/roles";
import { requireApiViewer } from "@/lib/server/auth";

const Input = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "scheduled", "seen", "closed"]),
  appointmentAt: z.string().optional(),
  note: z.string().trim().max(2000, "Notes can be at most 2000 characters.").optional(),
});

/**
 * Referral follow-up. The database function enforces clinic scope, that only specialists add
 * clinical notes, and that the AI result itself can never be changed.
 */
export async function reviewReferral(input: z.input<typeof Input>): Promise<{ error?: string }> {
  const { db, viewer } = await requireApiViewer(CLINICAL_ROLES);
  const p = Input.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid input." };
  // Health workers book the appointment; only the eye specialist records the outcome (seen / closed).
  if (viewer.role !== "specialist" && p.data.status !== "scheduled") {
    return { error: "Only eye specialists can record the outcome of a referral." };
  }
  let appointment: string | null = null;
  if (p.data.status === "scheduled") {
    // <input type="datetime-local"> gives wall-clock time; clinics run on Pakistan time (UTC+5).
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(p.data.appointmentAt ?? "");
    if (!m) return { error: "Choose the appointment date and time." };
    const at = new Date(`${m[1]}T${m[2]}:00+05:00`);
    if (at.getTime() < Date.now() - 60 * 60_000) return { error: "The appointment cannot be in the past." };
    appointment = at.toISOString();
  }
  const { error } = await db.rpc("review_screening", {
    p_id: p.data.id,
    p_status: p.data.status,
    p_appointment_at: appointment,
    p_note: p.data.note ? p.data.note : null,
  });
  if (error) {
    if (error.message.includes("only specialists")) return { error: "Only eye specialists can add clinical notes." };
    if (error.message.includes("not found")) return { error: "Screening not found in your clinic." };
    return { error: "The update could not be saved. Please try again." };
  }
  revalidatePath("/queue");
  revalidatePath("/dashboard");
  return {};
}
