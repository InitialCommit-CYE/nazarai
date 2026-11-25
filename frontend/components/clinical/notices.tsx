import { FlaskConical, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DISCLAIMER } from "@/lib/clinical";
import { cn } from "@/lib/utils";

export function SafetyDisclaimer({ className, showUrdu = true }: { className?: string; showUrdu?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm", className)} role="note">
      <p className="flex gap-2 text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{DISCLAIMER.en}</span>
      </p>
      {showUrdu && (
        <p dir="rtl" lang="ur" className="urdu mt-1 text-muted-foreground">
          {DISCLAIMER.ur}
        </p>
      )}
    </div>
  );
}

/** Shown whenever a result comes from the UNTRAINED pipeline-test model (development only). */
export function DevModelBanner({ modelVersion }: { modelVersion: string }) {
  return (
    <Alert className="border-urgent/40 bg-urgent-soft text-urgent">
      <FlaskConical aria-hidden="true" />
      <AlertTitle>Development model: not a real prediction</AlertTitle>
      <AlertDescription className="text-urgent/90">
        This result was produced by an untrained pipeline-test model ({modelVersion}) and is meaningless. It only exercises
        the software pipeline. Production refuses to serve this model.
      </AlertDescription>
    </Alert>
  );
}
