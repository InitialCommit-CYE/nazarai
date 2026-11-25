"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireApiViewer } from "@/lib/server/auth";

export async function updateProfileName(_prev: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const { viewer, db } = await requireApiViewer();
  const p = z.string().trim().min(2, "Enter your full name.").max(100).safeParse(form.get("fullName"));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { error } = await db.from("profiles").update({ full_name: p.data }).eq("id", viewer.id);
  if (error) return { error: "Your name could not be saved." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
