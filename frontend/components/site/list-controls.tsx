"use client";

import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

/** Debounced (300 ms) server-side search: the URL is the source of truth, so results are shareable. */
export function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const { params, update, pending } = useParamUpdater();
  const [value, setValue] = useState(params.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q: value.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative w-full sm:max-w-xs">
      {pending ? (
        <Loader2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 pr-8 pl-9"
        maxLength={50}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function ParamSelect({ name, label, options, defaultValue }: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const { params, update } = useParamUpdater();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <NativeSelect
        value={params.get(name) ?? defaultValue}
        onChange={(e) => update({ [name]: e.target.value === defaultValue ? null : e.target.value })}
        className="h-9 min-w-36 text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

/** Server-rendered page links (work without JavaScript); keeps the other query params. */
export function Pagination({ page, pageSize, total, basePath, params }: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(params);
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-4 pt-4 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-8 px-2.5" aria-disabled={page <= 1}>
          <Link href={href(page - 1)} className={page <= 1 ? "pointer-events-none opacity-50" : ""} tabIndex={page <= 1 ? -1 : undefined}>
            <ChevronLeft /> Previous
          </Link>
        </Button>
        <span className="text-muted-foreground tabular-nums">
          {page} / {pages}
        </span>
        <Button asChild variant="outline" size="sm" className="h-8 px-2.5" aria-disabled={page >= pages}>
          <Link href={href(page + 1)} className={page >= pages ? "pointer-events-none opacity-50" : ""} tabIndex={page >= pages ? -1 : undefined}>
            Next <ChevronRight />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
