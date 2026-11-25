"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";

export type RealtimeStatus = "connecting" | "live" | "offline";

/**
 * Live queue updates for signed-in staff: Postgres change events on public.screenings,
 * filtered by Row Level Security (staff only receive their own clinic's rows).
 */
export function subscribeToQueue(onChange: () => void, onStatus: (s: RealtimeStatus) => void): () => void {
  const sb = supabaseBrowser();
  if (!sb) {
    queueMicrotask(() => onStatus("offline"));
    return () => undefined;
  }
  const channel = sb
    .channel("clinic-queue")
    .on("postgres_changes", { event: "*", schema: "public", table: "screenings" }, () => onChange())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
    });
  return () => {
    void sb.removeChannel(channel);
  };
}
