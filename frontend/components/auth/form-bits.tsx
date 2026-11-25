"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Submit button that disables itself while the Server Action runs (no double submits). */
export function SubmitButton({ children, pendingText, className, variant }: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} disabled={pending} aria-disabled={pending} className={cn("h-10 w-full", className)}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <Alert variant={error ? "destructive" : "default"} className={cn(!error && "border-routine/30 bg-routine-soft")} role={error ? "alert" : "status"}>
      {error ? <AlertCircle /> : <CheckCircle2 className="text-routine" />}
      <AlertDescription className={cn(!error && "text-foreground")}>{error ?? ok}</AlertDescription>
    </Alert>
  );
}

export function Field({ id, label, hint, children, action }: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PasswordInput({ id, name, autoComplete, required = true }: { id: string; name: string; autoComplete: string; required?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} required={required} className="h-10 pr-10" maxLength={72} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
