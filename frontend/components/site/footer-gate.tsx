"use client";

import { usePathname } from "next/navigation";

/** Public pages keep the full site footer; inside the clinical app a single compact line is enough. */
const PUBLIC = (p: string) => p === "/" || p.startsWith("/about") || p.startsWith("/performance") || p.startsWith("/auth");

export function FooterGate({ full, compact }: { full: React.ReactNode; compact: React.ReactNode }) {
  const pathname = usePathname();
  return <>{PUBLIC(pathname) ? full : compact}</>;
}
