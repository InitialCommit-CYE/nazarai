import { AlertTriangle, CheckCircle2, Siren } from "lucide-react";

import { URGENCY_INFO } from "@/lib/clinical";
import type { Language, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

export const URGENCY_STYLE: Record<Urgency, { icon: typeof Siren; chip: string; solid: string; ring: string; text: string }> = {
  routine: {
    icon: CheckCircle2,
    chip: "bg-routine-soft text-routine border-routine/25",
    solid: "bg-routine text-white",
    ring: "ring-routine/30",
    text: "text-routine",
  },
  refer: {
    icon: AlertTriangle,
    chip: "bg-refer-soft text-[oklch(0.45_0.12_60)] border-refer/30",
    solid: "bg-refer text-white",
    ring: "ring-refer/30",
    text: "text-[oklch(0.45_0.12_60)]",
  },
  urgent: {
    icon: Siren,
    chip: "bg-urgent-soft text-urgent border-urgent/25",
    solid: "bg-urgent text-white",
    ring: "ring-urgent/30",
    text: "text-urgent",
  },
};

/** Colour + icon + text: urgency is never communicated by colour alone. */
export function ReferralBadge({ urgency, lang = "en", className }: { urgency: Urgency; lang?: Language; className?: string }) {
  const s = URGENCY_STYLE[urgency];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        s.chip,
        lang === "ur" && "urdu py-0 text-sm font-normal",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {URGENCY_INFO[urgency].title[lang]}
    </span>
  );
}
