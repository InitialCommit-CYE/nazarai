import { CalendarCheck, CheckCheck, CircleDashed, CircleSlash, Clock } from "lucide-react";

import type { ReferralStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const REFERRAL_STATUS: Record<ReferralStatus, { label: string; icon: typeof Clock; chip: string }> = {
  pending: { label: "Awaiting follow-up", icon: Clock, chip: "border-refer/30 bg-refer-soft text-refer" },
  scheduled: { label: "Appointment booked", icon: CalendarCheck, chip: "border-brand-blue/25 bg-accent text-accent-foreground" },
  seen: { label: "Seen by specialist", icon: CheckCheck, chip: "border-routine/25 bg-routine-soft text-routine" },
  closed: { label: "Closed", icon: CircleSlash, chip: "border-border bg-muted text-muted-foreground" },
  not_required: { label: "No referral needed", icon: CircleDashed, chip: "border-border bg-muted text-muted-foreground" },
};

/** Referral follow-up state: icon + text, never colour alone. */
export function ReferralStatusBadge({ status, className }: { status: ReferralStatus; className?: string }) {
  const s = REFERRAL_STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", s.chip, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s.label}
    </span>
  );
}
