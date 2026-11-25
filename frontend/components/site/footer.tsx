import Link from "next/link";

import { DISCLAIMER } from "@/lib/clinical";

import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            AI screening and triage support for diabetic retinopathy, built for diabetes clinics and Basic Health Units in
            Pakistan. Capital Youth Expo Hackathon 2026, Healthcare track.
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{DISCLAIMER.en}</p>
          <p dir="rtl" lang="ur" className="urdu max-w-md text-xs text-muted-foreground">
            {DISCLAIMER.ur}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/screen">Screen a patient</Link></li>
            <li><Link className="hover:text-foreground" href="/queue">Referrals</Link></li>
            <li><Link className="hover:text-foreground" href="/auth/sign-in">Sign in</Link></li>
            <li><Link className="hover:text-foreground" href="/auth/sign-up">Patient sign-up</Link></li>
            <li><Link className="hover:text-foreground" href="/performance">Model performance</Link></li>
            <li><Link className="hover:text-foreground" href="/about">About &amp; safety</Link></li>
            <li><Link className="hover:text-foreground" href="/about#privacy">Privacy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Data &amp; credits</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Demo images: IDRiD (CC BY 4.0), Porwal et al.</li>
            <li>Training data: APTOS 2019 + EyePACS</li>
            <li>Reports: fixed Urdu / English templates</li>
            <li>Hosting: Vercel · Supabase · Hugging Face</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Demo deployment. Synthetic patient references only. No real patient data is stored.
      </div>
    </footer>
  );
}
