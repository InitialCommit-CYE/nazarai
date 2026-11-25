import { cn } from "@/lib/utils";

/**
 * NazarAI mark: a fundus seen through the pupil. Ink disc, the optic disc (bright, off-centre, as in a real
 * retina photo) and two vessel arcs leaving it. Flat colours only, so it survives favicons and print.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-8", className)}>
      <circle cx="20" cy="20" r="19" fill={inverted ? "var(--ink-foreground)" : "var(--ink)"} />
      <path
        d="M25.5 17.2C20 13.5 13 13.8 8.6 18.4M26 22.6c-4.6 4.4-11.4 5.2-16.8 1.8"
        stroke={inverted ? "var(--ink)" : "var(--signal)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <circle cx="27" cy="20" r="4.2" fill={inverted ? "var(--primary)" : "var(--ink-foreground)"} />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span className="flex items-baseline gap-1">
        <span className="font-display text-[1.35rem] leading-none font-medium">Nazar</span>
        <span className={cn("eyebrow text-[0.65rem] font-medium", inverted ? "text-signal" : "text-primary")}>AI</span>
      </span>
    </span>
  );
}
