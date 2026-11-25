import { BellOff, CalendarCheck, ClipboardCheck, Siren, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MarkAllRead } from "@/components/settings/mark-all-read";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/site/page-bits";
import { timeAgo } from "@/lib/format";
import { requireViewer } from "@/lib/server/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const ICON = { referral: Siren, appointment: CalendarCheck, result: ClipboardCheck, account: UserRound } as const;

export default function NotificationsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <Notifications />
      </Suspense>
    </PageContainer>
  );
}

async function Notifications() {
  const { db } = await requireViewer({ next: "/notifications" });
  const { data } = await db.from("notifications").select("id, kind, title, body, link, created_at, read_at").order("created_at", { ascending: false }).limit(50);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You are all caught up."} actions={unread ? <MarkAllRead /> : undefined} />
      {rows.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications yet" description="New referrals, results and appointments will show up here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((n) => {
            const Icon = ICON[n.kind as keyof typeof ICON] ?? ClipboardCheck;
            const body = (
              <div className="flex gap-3 px-5 py-4">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", n.kind === "referral" ? "bg-urgent-soft text-urgent" : "bg-secondary text-primary")}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>
                    {n.title}
                    {!n.read_at && <span className="ml-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="unread" />}
                  </p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at as string)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id as string} className={cn(!n.read_at && "bg-secondary/40")}>
                {n.link ? (
                  <Link href={n.link as string} className="block transition-colors hover:bg-muted/50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
