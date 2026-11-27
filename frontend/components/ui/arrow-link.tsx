import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/*
 * The primary action: a pill with the label on the left and a round arrow chip on the right.
 * `light` is the off-white pill used on dark ground; `dark` is the near-black pill used on light surfaces.
 */
export function arrowPillClasses(tone: "light" | "dark" = "light", className?: string) {
  return cn(
    "group/arrow press inline-flex min-h-13 items-center justify-between gap-6 rounded-full py-1.5 ps-5 pe-1.5 text-[0.9375rem] font-medium hover:font-semibold focus-visible:font-semibold",
    "border transition-[color,border-color,box-shadow,transform,font-weight,letter-spacing] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    tone === "light" ? "liquid-light border-white/70 text-primary-foreground" : "liquid border-white/15 hover:border-white/30",
    className,
  );
}

export function ArrowChip({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        tone === "light" ? "liquid-chip text-[#f4f3ef]" : "bg-[#f4f3ef] text-[#060708]",
      )}
    >
      <ArrowUpRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/arrow:translate-x-0.5 group-hover/arrow:-translate-y-0.5" strokeWidth={1.75} />
    </span>
  );
}

export function ArrowLink({
  href,
  children,
  tone = "light",
  className,
  plain = false,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
  /** A plain <a> (no prefetch, full navigation): for routes that act, like the one-click demo sign-in. */
  plain?: boolean;
}) {
  const inner = (
    <>
      <span>{children}</span>
      <ArrowChip tone={tone} />
    </>
  );
  return plain ? (
    <a href={href} className={arrowPillClasses(tone, className)}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={arrowPillClasses(tone, className)}>
      {inner}
    </Link>
  );
}

/** The secondary action: plain text and an arrow, underlined on hover. */
export function QuietLink({ href, children, className, plain = false }: { href: string; children: React.ReactNode; className?: string; plain?: boolean }) {
  const Tag = plain ? "a" : Link;
  return (
    <Tag
      href={href}
      className={cn(
        "group/quiet inline-flex min-h-11 items-center gap-3 text-[0.9375rem] font-medium underline-offset-[6px] transition-[color,font-weight] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:font-semibold hover:underline focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/quiet:translate-x-1" strokeWidth={1.5} aria-hidden />
    </Tag>
  );
}
