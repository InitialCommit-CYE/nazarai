"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client with the PUBLISHABLE key, used only for Realtime broadcasts.
 * It cannot read any table (RLS denies anon); the broadcast carries only {id, urgency},
 * and the queue then refetches through the server route.
 */
let client: SupabaseClient | null = null;

function browserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type RealtimeStatus = "connecting" | "live" | "offline";

export function subscribeToQueue(onChange: () => void, onStatus: (s: RealtimeStatus) => void): () => void {
  const sb = browserClient();
  if (!sb) {
    queueMicrotask(() => onStatus("offline"));
    return () => undefined;
  }
  const channel = sb
    .channel("clinic-queue")
    .on("broadcast", { event: "screening_created" }, () => onChange())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
    });
  return () => {
    sb.removeChannel(channel);
  };
}
