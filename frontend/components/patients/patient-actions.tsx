"use client";

import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { deletePatient, issueAccessCode } from "@/app/patients/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeletePatientButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog onOpenChange={() => setError(null)}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg" className="h-9 px-3">
          <Trash2 /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the patient record and all of their screening results and reports. The deletion is
            recorded in the audit log. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep record</AlertDialogCancel>
          <Button
            variant="destructive"
            size="lg"
            className="px-4"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deletePatient(id);
                if (r?.error) setError(r.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AccessCodeButton({ id, linked, hasActiveCode }: { id: string; linked: boolean; hasActiveCode: boolean }) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (linked) return null;
  return (
    <AlertDialog
      onOpenChange={(o) => {
        if (!o) {
          setCode(null);
          setError(null);
          setCopied(false);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-9 px-3">
          <KeyRound /> Patient access code
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Give the patient online access</AlertDialogTitle>
          <AlertDialogDescription>
            The patient creates an account, then enters this code and their birth year to see their results. The code
            works once and expires in 14 days.
            {hasActiveCode && " Creating a new code cancels the previous one."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {code ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-secondary px-4 py-3">
              <span className="font-mono text-2xl font-semibold tracking-[0.3em]" aria-label={`Access code ${code.split("").join(" ")}`}>
                {code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy code"
                onClick={async () => {
                  await navigator.clipboard.writeText(code).catch(() => undefined);
                  setCopied(true);
                }}
              >
                {copied ? <Check className="text-routine" /> : <Copy />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Write it on the referral slip or read it out to the patient. It will not be shown again.
            </p>
          </div>
        ) : (
          error && <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{code ? "Done" : "Cancel"}</AlertDialogCancel>
          {!code && (
            <Button
              size="lg"
              className="px-4"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await issueAccessCode(id);
                  if (r.code) setCode(r.code);
                  else setError(r.error ?? "Something went wrong.");
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Create code
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
