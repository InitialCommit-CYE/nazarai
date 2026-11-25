import { cn } from "@/lib/utils";

/**
 * NazarAI mark (variation 4, "lens"): an outer lens ring, the Urdu letter ن (noon, the first letter of
 * Nazar) as the inner bowl, and its dot drawn as an iris. Keep app/icon.svg in sync with this drawing.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const ink = inverted ? "var(--ink-foreground)" : "var(--ink)";
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-9", className)}>
      <path d="M38.1 9.9A20 20 0 1 1 29.2 4.7" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M11.8 19.6A13 13 0 1 0 36.2 19.6L33.9 7.6Q32.6 6.2 31.2 8.1L34 16.4A11 11 0 1 1 13.7 17.2Z" fill={ink} />
      <circle cx="24" cy="24.5" r="5.4" fill="#7FD4DF" />
      <circle cx="25" cy="23.6" r="3" fill="#4FB0BF" />
      <circle cx="26.1" cy="22.4" r="1.3" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span className={cn("font-display text-[1.35rem] leading-none", inverted ? "text-ink-foreground" : "text-ink")}>NazarAI</span>
    </span>
  );
}
