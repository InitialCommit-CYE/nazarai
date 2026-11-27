import { AlertTriangle, CheckCircle2, Siren } from "lucide-react";

import { URGENCY_INFO } from "@/lib/clinical";
import type { Language, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

export const URGENCY_STYLE: Record<Urgency, { icon: typeof Siren; chip: string; solid: string; inkChip: string; ring: string; text: string; dot: string }> = {
  routine: {
    icon: CheckCircle2,
    chip: "bg-routine-soft text-routine border-routine/25",
    solid: "bg-routine text-routine-ink",
    inkChip: "bg-routine-ink text-routine",
    ring: "ring-routine/30",
    text: "text-routine",
    dot: "bg-routine",
  },
  refer: {
    icon: AlertTriangle,
    chip: "bg-refer-soft text-refer border-refer/30",
    solid: "bg-refer text-refer-ink",
    inkChip: "bg-refer-ink text-refer",
    ring: "ring-refer/30",
    text: "text-refer",
    dot: "bg-refer",
  },
  urgent: {
    icon: Siren,
    chip: "bg-urgent-soft text-urgent border-urgent/25",
    solid: "bg-urgent-flood text-urgent-ink",
    inkChip: "bg-[#3a0a0c] text-white",
    ring: "ring-urgent/30",
    text: "text-urgent",
    dot: "bg-urgent",
  },
};

/** Colour + icon + text: urgency is never communicated by colour alone. */
export function ReferralBadge({ urgency, lang = "en", className }: { urgency: Urgency; lang?: Language; className?: string }) {
  const s = URGENCY_STYLE[urgency];

  return (
    <span className={cn("inline-flex items-center gap-2 text-[0.8125rem] font-medium whitespace-nowrap", s.text, lang === "ur" && "urdu text-sm font-normal", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", s.dot)} aria-hidden="true" />
      {URGENCY_INFO[urgency].title[lang]}
    </span>
  );
}
