"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/** Unread count (RLS: own notifications only), refreshed live and on every navigation. */
export function NotificationBell({ userId, pathname }: { userId: string; pathname: string | null }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [userId, refresh]);

  return (
    <Link
      href="/notifications"
      className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={unread ? `Notifications: ${unread} unread` : "Notifications"}
    >
      <Bell className="size-[18px]" />
      {unread > 0 && (
        <span
          className={cn(
            "absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] leading-4 font-semibold text-white",
          )}
          aria-hidden
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
