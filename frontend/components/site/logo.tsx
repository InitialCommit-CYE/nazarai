import { cn } from "@/lib/utils";

/** NazarAI mark: an eye whose iris is a stylised retina (vessels from the optic disc). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <linearGradient id="nz-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.55 0.1 190)" />
          <stop offset="1" stopColor="oklch(0.5 0.14 250)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#nz-g)" />
      <path d="M6 20c3.6-6 8.4-9 14-9s10.4 3 14 9c-3.6 6-8.4 9-14 9S9.6 26 6 20Z" fill="white" opacity="0.95" />
      <circle cx="20" cy="20" r="6.6" fill="oklch(0.42 0.08 195)" />
      <circle cx="22.2" cy="18.6" r="1.7" fill="oklch(0.93 0.09 85)" />
      <path d="M22 18.8c-2 .6-4 .2-5.6-1.2M22.4 19.6c-1 1.9-2.8 3-5 3.2" stroke="oklch(0.8 0.12 30)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">
        Nazar<span className="text-primary">AI</span>
      </span>
    </span>
  );
}
