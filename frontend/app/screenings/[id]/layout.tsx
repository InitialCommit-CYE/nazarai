import { Suspense } from "react";

import { ScreeningShell } from "@/components/results/screening-shell";
import { Skeleton } from "@/components/ui/skeleton";

function ShellFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export default function ScreeningLayout({ children }: LayoutProps<"/screenings/[id]">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ScreeningShell>{children}</ScreeningShell>
    </Suspense>
  );
}
