"use client";

import { Compass, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { ArrowChip, arrowPillClasses } from "@/components/ui/arrow-link";
import type { AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

/*
 * Guided demo for first-time visitors (judges). It appears for the shared demo accounts only, follows the page
 * the visitor is on, and can be closed at any time (remembered in localStorage; "Show guide" brings it back).
 * The screening page reports its state (patient chosen? photo added?) through publishScreenState().
 */

const KEY = "nazarai-guide";
const EVT = "nazarai-guide";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}
function readGuide(): "open" | "closed" {
  try {
    return localStorage.getItem(KEY) === "closed" ? "closed" : "open";
  } catch {
    return "open";
  }
}
function setGuide(v: "open" | "closed") {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked: the guide just won't remember */
  }
  window.dispatchEvent(new Event(EVT));
}

let screenState = "00";
export function publishScreenState(patient: boolean, photo: boolean) {
  const next = `${patient ? 1 : 0}${photo ? 1 : 0}`;
  if (next === screenState) return;
  screenState = next;
  window.dispatchEvent(new Event(EVT));
}

interface Step {
  /** 0 = an orientation card outside the numbered flow (the dashboard). */
  n: number;
  of: number;
  title: string;
  body: string;
  action?: { label: string; href?: string; switchTo?: "eye-specialist" | "health-worker" };
}

function stepFor(role: AppRole, path: string, screen: string): Step | null {
  if (role === "operator") {
    // One-click visitors land on /screen, so the numbered flow starts there; the dashboard is an orientation card.
    const of = 4;
    if (path === "/dashboard")
      return {
        n: 0,
        of,
        title: "Today’s clinic",
        body: "These are the clinic’s patients and who is due for their yearly eye check. Press Screen next to a patient to begin.",
        action: { label: "Screen a patient", href: "/screen" },
      };
    if (path === "/screen") {
      if (screen[0] === "0")
        return {
          n: 1,
          of,
          title: "Pick the patient",
          body: "You are the health worker at a diabetes clinic. Choose a patient, for example Tariq Mehmood. The photo can never land on the wrong record.",
        };
      if (screen[1] === "0")
        return {
          n: 2,
          of,
          title: "Add a retina photo",
          body: "There’s no camera here, so tap a sample photo from a public dataset. Each sample is a different case; one is a poor photo the quality gate will reject.",
        };
      return { n: 3, of, title: "Run the screening", body: "Press Run screening and watch the photo being checked, graded and explained." };
    }
    if (path.startsWith("/screenings/"))
      return {
        n: 4,
        of,
        title: "Read the decision",
        body: "The colour says what to do, in English and Urdu. The checklist covers the rest: the patient report, booking the specialist, the slip. Then see the other side.",
        action: { label: "Switch to specialist", switchTo: "eye-specialist" },
      };
    return null;
  }
  if (role === "specialist") {
    const of = 2;
    if (path === "/queue")
      return { n: 1, of, title: "The specialist’s worklist", body: "Referrals from the clinic arrive here live, urgent first. Open one to review it." };
    if (path.startsWith("/screenings/"))
      return {
        n: 2,
        of,
        title: "Record the outcome",
        body: "Check the heatmap, add your note and mark the patient as seen. That closes the loop. Close this guide to explore freely.",
        action: { label: "Back to health worker", switchTo: "health-worker" },
      };
    return null;
  }
  return null;
}

export function DemoGuide({ role, email, pathname }: { role: AppRole; email: string; pathname: string | null }) {
  const state = useSyncExternalStore(subscribe, readGuide, () => "closed" as const);
  const screen = useSyncExternalStore(subscribe, () => screenState, () => "00");
  const isDemo = email.endsWith("@demo.nazarai.app");
  if (!isDemo || !pathname) return null;
  const step = stepFor(role, pathname, screen);
  if (!step) return null;

  if (state === "closed") {
    return (
      <button
        type="button"
        onClick={() => setGuide("open")}
        className="liquid press fixed right-4 bottom-4 z-50 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-[border-color,box-shadow,transform,font-weight] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:font-semibold"
      >
        <Compass className="size-4" aria-hidden /> Show guide
      </button>
    );
  }

  return (
    <aside
      aria-label="Guided demo"
      className="glass-strong rise-in fixed right-3 bottom-3 left-3 z-50 flex flex-col gap-3 rounded-[24px] p-5 sm:right-5 sm:bottom-5 sm:left-auto sm:w-[23rem]"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
        <span>{step.n > 0 ? `Guided demo · step ${step.n} of ${step.of}` : "Guided demo"}</span>
        {step.n > 0 && (
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: step.of }).map((_, i) => (
              <span key={i} className={cn("h-1 w-4 rounded-full", i < step.n ? "bg-foreground" : "bg-white/20")} />
            ))}
          </span>
        )}
      </div>
      <h2 className="text-2xl leading-tight font-medium tracking-[-0.02em]">{step.title}</h2>
      <p className="text-[0.95rem] leading-relaxed text-[#d5d8dc]">{step.body}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setGuide("closed")} className="flex min-h-11 items-center gap-1.5 text-sm whitespace-nowrap text-ink-muted hover:text-foreground">
          <X className="size-3.5" aria-hidden /> Close guide
        </button>
        {step.action?.href && (
          <Link href={step.action.href} className={arrowPillClasses("light", "min-h-11 gap-3 ps-4 pe-1 text-sm whitespace-nowrap")}>
            <span>{step.action.label}</span>
            <ArrowChip />
          </Link>
        )}
        {step.action?.switchTo && (
          <form action="/auth/sign-out" method="post">
            <input type="hidden" name="switch" value={step.action.switchTo} />
            <button type="submit" className={arrowPillClasses("light", "min-h-11 gap-3 ps-4 pe-1 text-sm whitespace-nowrap")}>
              <span>{step.action.label}</span>
              <ArrowChip />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
