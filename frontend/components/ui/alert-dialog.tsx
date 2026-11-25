"use client";

import * as React from "react";
import { cn } from "cn";
import { AlertDialog as P } from "radix-ui";

import { buttonVariants } from "@/components/ui/button";

/** Confirmation dialog for destructive or irreversible actions (focus-trapped, Esc to cancel). */
export const AlertDialog = P.Root;
export const AlertDialogTrigger = P.Trigger;

export function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <P.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof P.Title>) {
  return <P.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof P.Description>) {
  return <P.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof P.Action>) {
  return <P.Action className={cn(buttonVariants({ size: "lg" }), "px-4", className)} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof P.Cancel>) {
  return <P.Cancel className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4", className)} {...props} />;
}
