import type { Metadata } from "next";

import { ClinicQueue } from "@/components/queue/clinic-queue";

export const metadata: Metadata = { title: "Clinic queue" };

export default function QueuePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">Clinic dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Screening queue</h1>
        <p className="mt-2 text-muted-foreground">
          Every screening, sorted so urgent referrals come first. Stored in Supabase; updates live as new screenings arrive.
        </p>
      </div>
      <ClinicQueue />
    </div>
  );
}
