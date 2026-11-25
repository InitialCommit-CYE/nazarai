import type { Metadata } from "next";

import { ScreeningWorkspace } from "@/components/screening/screening-workspace";

export const metadata: Metadata = { title: "Screen a patient" };

export default function ScreenPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">Screening</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Screen a retina photo</h1>
        <p className="mt-2 text-muted-foreground">
          The image is checked for quality, graded on the International Clinical DR scale, explained with Grad-CAM, and
          then deleted. Only the result is saved.
        </p>
      </div>
      <ScreeningWorkspace />
    </div>
  );
}
