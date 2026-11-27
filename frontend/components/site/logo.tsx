import { cn } from "@/lib/utils";

/**
 * NazarAI mark: an aperture ring, a pupil, the off-centre optic disc of a real retina photo, and the scan line
 * that reads it. The scan line can take a triage colour (it "lights up" with the result).
 * Keep app/icon.svg in sync with this drawing.
 */
export function LogoMark({ className, scan = "currentColor" }: { className?: string; scan?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <mask id="nz-scan-cut">
          <rect width="100" height="100" fill="#fff" />
          <rect x="0" y="45" width="100" height="10" fill="#000" />
        </mask>
      </defs>
      <g mask="url(#nz-scan-cut)" fill="currentColor">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
        <circle cx="50" cy="50" r="15" />
        <circle cx="66" cy="31" r="6" />
      </g>
      <line x1="3" y1="50" x2="97" y2="50" stroke={scan} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, scan }: { className?: string; scan?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-foreground", className)}>
      <LogoMark scan={scan} className="size-7" />
      <span className="text-[1.3rem] leading-none font-bold tracking-[-0.025em]">NazarAI</span>
    </span>
  );
}
