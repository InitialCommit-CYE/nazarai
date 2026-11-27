"use client";

import { Bell, LogOut, Menu, ScanEye, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { navFor, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { DemoGuide } from "./demo-guide";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";

export interface NavViewer {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  clinicName: string | null;
}

export function NavbarClient(props: { viewer: NavViewer | null; loading?: boolean }) {
  return (
    <Suspense fallback={<NavbarView {...props} pathname={null} />}>
      <NavbarWithPath {...props} />
    </Suspense>
  );
}

function NavbarWithPath(props: { viewer: NavViewer | null; loading?: boolean }) {
  return <NavbarView {...props} pathname={usePathname()} />;
}

function initials(v: NavViewer) {
  const src = v.fullName.trim() || v.email;
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function NavbarView({ viewer, loading, pathname }: { viewer: NavViewer | null; loading?: boolean; pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const signOutRef = useRef<HTMLFormElement>(null);

  const links = loading ? [] : navFor(viewer?.role ?? null);
  const clinical = viewer?.role === "operator" || viewer?.role === "specialist";
  const isActive = (href: string) =>
    pathname != null &&
    (pathname === href ||
      (href !== "/" && pathname.startsWith(`${href}/`) && href !== "/my") ||
      (href === "/queue" && viewer?.role === "specialist" && pathname.startsWith("/screenings")));

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 text-foreground sm:px-5">
      <form ref={signOutRef} action="/auth/sign-out" method="post" className="hidden" />
      {viewer && !loading && <DemoGuide role={viewer.role} email={viewer.email} pathname={pathname} />}
      <nav className="glass mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full bg-[#0b0c0e]/70 pr-2 pl-5" aria-label="Main">
        <div className="flex min-w-0 items-center gap-8">
          <Link href={viewer ? (viewer.role === "patient" ? "/my" : "/dashboard") : "/"} className="shrink-0 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.94rem] text-ink-muted transition-colors hover:text-white",
                  isActive(l.href) && "bg-white/10 text-white",
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {loading ? (
            <Skeleton className="size-9 rounded-full" />
          ) : viewer ? (
            <>
              {clinical && (
                <Button asChild size="sm" className="mr-1 hidden h-10 px-4 sm:inline-flex">
                  <Link href="/screen">
                    <ScanEye /> Screen
                  </Link>
                </Button>
              )}
              <NotificationBell userId={viewer.id} pathname={pathname} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-1 hidden size-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white transition-shadow hover:ring-2 hover:ring-white/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:flex"
                    aria-label="Account menu"
                  >
                    {initials(viewer)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    <p className="truncate font-medium">{viewer.fullName || viewer.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
                    <p className="mt-1 text-xs text-primary">
                      {ROLE_LABEL[viewer.role]}
                      {viewer.clinicName ? ` · ${viewer.clinicName}` : ""}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings /> Account settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications">
                      <Bell /> Notifications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOutRef.current?.requestSubmit()}>
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden h-10 px-4 text-ink-foreground hover:bg-white/10 hover:text-white sm:inline-flex">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-10 px-5">
                <Link href="/auth/sign-in?demo=health-worker">
                  Try the demo
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-ink-foreground hover:bg-white/10 hover:text-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {open && (
        <div id="mobile-nav" className="glass-strong mx-auto mt-2 max-w-7xl rounded-3xl bg-[#0b0c0e]/90 px-4 pb-4 text-foreground md:hidden">
          {viewer && (
            <div className="border-b border-border py-3">
              <p className="truncate font-medium">{viewer.fullName || viewer.email}</p>
              <p className="text-xs text-primary">
                {ROLE_LABEL[viewer.role]}
                {viewer.clinicName ? ` · ${viewer.clinicName}` : ""}
              </p>
            </div>
          )}
          <ul className="flex flex-col gap-1 pt-2">
            {[...links, ...(clinical ? [{ href: "/screen", label: "Start screening" }] : []), ...(viewer ? [{ href: "/settings", label: "Account settings" }] : [])]
              .filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i)
              .map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(l.href) ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 text-base font-medium",
                      isActive(l.href) ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            {viewer ? (
              <li>
                <button
                  type="button"
                  onClick={() => signOutRef.current?.requestSubmit()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-destructive hover:bg-muted"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </li>
            ) : (
              <li>
                <Link href="/auth/sign-in" className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted">
                  Sign in
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
