import Link from "next/link";

import { DISCLAIMER } from "@/lib/clinical";

import { Logo } from "./logo";

/* Public links only: the footer is shared by signed-out visitors and every role, so it never shows
   role-specific actions (those live in the navbar). */
const EXPLORE = [
  { href: "/#problem", label: "The problem" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/performance", label: "Model performance" },
  { href: "/about", label: "About & safety" },
  { href: "/about#privacy", label: "Privacy" },
];

const CREDITS = [
  "Training data: APTOS 2019 (India) + EyePACS",
  "External test and demo images: IDRiD, CC BY 4.0",
  "Reports: fixed Urdu / English templates",
  "Hosting: Vercel · Supabase",
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-paper">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            AI screening and triage support for diabetic retinopathy, built for diabetes clinics and Basic Health Units in
            Pakistan. Capital Youth Expo Hackathon 2026, Healthcare track.
          </p>
          <div className="max-w-md border-l-2 border-primary pl-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{DISCLAIMER.en}</p>
            <p dir="rtl" lang="ur" className="urdu mt-2 text-sm text-muted-foreground">
              {DISCLAIMER.ur}
            </p>
          </div>
        </div>
        <nav aria-label="Footer">
          <h2 className="eyebrow text-muted-foreground">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link className="text-foreground/80 underline-offset-4 hover:text-foreground hover:underline" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow text-muted-foreground">Data &amp; credits</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-foreground/80">
            {CREDITS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 font-mono text-xs text-muted-foreground sm:px-6">
          Demo deployment · synthetic patient references only · no real patient data is stored
        </p>
      </div>
    </footer>
  );
}
