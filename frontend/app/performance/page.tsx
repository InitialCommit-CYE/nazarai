import type { Metadata } from "next";

import { PerformanceDashboard } from "@/components/performance/performance-dashboard";

export const metadata: Metadata = { title: "Model performance" };

export default function PerformancePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow text-primary">Evidence</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">Model performance</h1>
        <p className="mt-2 text-muted-foreground">
          Measured results of the deployed model on a held-out validation split and on IDRiD, an external dataset the model
          never saw during training or threshold tuning, reported next to the FDA-cleared IDx-DR benchmark.
        </p>
      </div>
      <PerformanceDashboard />
    </div>
  );
}
