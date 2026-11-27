import { CalendarCheck, CheckCheck, CircleDashed, CircleSlash, Clock } from "lucide-react";

import type { ReferralStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const REFERRAL_STATUS: Record<ReferralStatus, { label: string; icon: typeof Clock; chip: string }> = {
  pending: { label: "Awaiting follow-up", icon: Clock, chip: "text-refer" },
  scheduled: { label: "Appointment booked", icon: CalendarCheck, chip: "text-foreground" },
  seen: { label: "Seen by specialist", icon: CheckCheck, chip: "text-routine" },
  closed: { label: "Closed", icon: CircleSlash, chip: "text-muted-foreground" },
  not_required: { label: "No referral needed", icon: CircleDashed, chip: "text-muted-foreground" },
};

/** Referral follow-up state as quiet text: icon + label, never colour alone. */
export function ReferralStatusBadge({ status, className }: { status: ReferralStatus; className?: string }) {
  const s = REFERRAL_STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap", s.chip, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s.label}
    </span>
  );
}
