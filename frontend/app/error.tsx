"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Any page that fails to render shows this instead of a blank screen. No internals are leaked. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-urgent-soft text-urgent">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{offline ? "You appear to be offline" : "This page could not be loaded"}</h1>
      <p className="mt-2 text-muted-foreground">
        {offline
          ? "Check the internet connection, then try again. Nothing you saved has been lost."
          : "Something went wrong on our side. Please try again. If it keeps happening, tell your clinic administrator."}
      </p>
      {digest && <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <div className="mt-8 flex gap-2">
        <Button size="lg" className="h-10 px-4" onClick={() => retry()}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline" size="lg" className="h-10 px-4">
          <Link href="/">
            <Home /> Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
