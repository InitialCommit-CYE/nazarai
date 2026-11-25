"use client";

import { AlertCircle, CameraOff, CheckCircle2, ChevronRight, Inbox, Radio, RefreshCcw, Siren, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReferralBadge } from "@/components/clinical/referral-badge";
import { ReferralStatusBadge } from "@/components/clinical/referral-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getQueue } from "@/lib/client/api";
import { subscribeToQueue, type RealtimeStatus } from "@/lib/client/realtime";
import { GRADES } from "@/lib/clinical";
import { formatDateTime, formatTime, pct } from "@/lib/format";
import type { QueueResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number | undefined; icon: typeof Siren; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className={cn("size-4", tone)} aria-hidden="true" />
      </div>
      {value == null ? <Skeleton className="mt-2 h-9 w-12" /> : <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>}
    </div>
  );
}

const LIVE_LABEL: Record<RealtimeStatus, string> = { connecting: "Connecting…", live: "Live updates", offline: "Auto-refresh every 30 s" };

export function ClinicQueue() {
  const router = useRouter();
  const [scope, setScope] = useState<"open" | "today" | "all">("open");
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState<RealtimeStatus>("connecting");
  const [flash, setFlash] = useState<string | null>(null);
  const known = useRef<Set<string>>(new Set());

  const apply = useCallback((q: QueueResponse) => {
    const fresh = q.items.find((i) => known.current.size > 0 && !known.current.has(i.id));
    known.current = new Set(q.items.map((i) => i.id));
    if (fresh) {
      setFlash(fresh.id);
      setTimeout(() => setFlash(null), 2500);
    }
    setData(q);
    setError(null);
  }, []);
  const fail = useCallback((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the queue."), []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      apply(await getQueue(scope === "today" ? "today" : "all", scope === "open"));
    } catch (e) {
      fail(e);
    } finally {
      setRefreshing(false);
    }
  }, [scope, apply, fail]);

  useEffect(() => {
    let cancelled = false;
    getQueue(scope === "today" ? "today" : "all", scope === "open")
      .then((q) => !cancelled && apply(q))
      .catch((e) => !cancelled && fail(e));
    return () => {
      cancelled = true;
    };
  }, [scope, apply, fail]);
  useEffect(() => subscribeToQueue(() => void load(), setLive), [load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const c = data?.counts;
  return (
    <div className="space-y-6">
      {/* One filter row above everything it scopes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Show" className="inline-flex rounded-xl border border-border bg-muted p-1">
          {(["open", "today", "all"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={scope === s}
              onClick={() => {
                known.current = new Set();
                setScope(s);
              }}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium",
                scope === s ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "open" ? "Open referrals" : s === "today" ? "Today (PKT)" : "All screenings"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <Radio className={cn("size-3.5", live === "live" ? "text-routine" : "text-muted-foreground")} />
            {LIVE_LABEL[live]}
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
            <RefreshCcw className={refreshing ? "animate-spin" : undefined} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Screened" value={c?.total} icon={Users} tone="text-primary" />
        <StatCard label="Urgent referrals" value={c?.urgent} icon={Siren} tone="text-urgent" />
        <StatCard label="Specialist referrals" value={c?.refer} icon={TriangleAlert} tone="text-refer" />
        <StatCard label="Routine (12 months)" value={c?.routine} icon={CheckCircle2} tone="text-routine" />
        <StatCard label="Retake needed" value={c?.rejected} icon={CameraOff} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Queue unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={cn("overflow-hidden rounded-2xl border border-border bg-card transition-opacity", data && refreshing && "opacity-60")}>
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">Screenings sorted by urgency, then most recent first</caption>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-5">Priority</TableHead>
                <TableHead>Patient ref.</TableHead>
                <TableHead>AI grade</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Screened</TableHead>
                <TableHead className="pr-5"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data &&
                !error &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="px-5"><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 font-medium">{scope === "open" ? "No open referrals" : `No screenings ${scope === "today" ? "today" : "yet"}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {scope === "open" ? "Referable results waiting for specialist follow-up appear here, urgent first." : "Screened patients appear here automatically, most urgent first."}
                    </p>
                    <Button asChild className="mt-4" size="sm"><Link href="/screen">Screen a patient</Link></Button>
                  </TableCell>
                </TableRow>
              )}
              {data?.items.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn("cursor-pointer", flash === r.id && "bg-secondary motion-safe:animate-pulse")}
                  onClick={() => router.push(`/screenings/${r.id}`)}
                >
                  <TableCell className="pl-5">
                    {r.quality_ok && r.urgency ? (
                      <ReferralBadge urgency={r.urgency} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        <CameraOff className="size-3.5" /> Retake photo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.demo_patient_code ?? <span className="text-muted-foreground">–</span>}
                    {!r.model_trained && <Badge variant="destructive" className="ml-2">dev model</Badge>}
                  </TableCell>
                  <TableCell>{r.grade != null ? `${r.grade} · ${GRADES[r.grade].short}` : "Not graded"}</TableCell>
                  <TableCell>
                    {r.quality_ok && r.referral_status !== "not_required" ? (
                      <ReferralStatusBadge status={r.referral_status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.quality_ok ? `Confidence ${pct(r.confidence, 0)}` : "–"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground" title={formatDateTime(r.created_at)}>
                    {scope === "today" ? formatTime(r.created_at) : formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Link href={`/screenings/${r.id}`} aria-label={`Open screening ${r.demo_patient_code ?? r.id.slice(0, 8)}`} onClick={(e) => e.stopPropagation()} className="inline-flex rounded-md p-1 text-muted-foreground hover:text-foreground">
                      <ChevronRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
