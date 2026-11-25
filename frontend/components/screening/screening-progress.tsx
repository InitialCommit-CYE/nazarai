"use client";

import { Check, Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

const STAGES = [
  { key: "upload", label: "Secure upload", hint: "Encrypted, temporary, private storage" },
  { key: "analyze", label: "Quality check, grading & Grad-CAM", hint: "Running on the NazarAI ML service" },
  { key: "save", label: "Result saved", hint: "Image deleted; metadata stored" },
] as const;

export function ScreeningProgress({ phase, uploadPct }: { phase: Phase; uploadPct: number }) {
  if (phase === "idle") return null;
  const activeIndex = phase === "uploading" ? 0 : phase === "analyzing" ? 1 : phase === "done" ? 3 : -1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5" aria-live="polite">
      <ol className="space-y-4">
        {STAGES.map((s, i) => {
          const complete = activeIndex > i;
          const active = activeIndex === i;
          return (
            <li key={s.key} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  complete && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !complete && !active && "border-border text-muted-foreground",
                )}
              >
                {complete ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", !complete && !active && "text-muted-foreground")}>{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
                {active && i === 0 && <Progress value={uploadPct} className="mt-2 h-1.5" aria-label="Upload progress" />}
                {active && i === 1 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    The first request after a quiet period can take up to a minute while the free ML server wakes up.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
