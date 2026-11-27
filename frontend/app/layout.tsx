import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Noto_Nastaliq_Urdu } from "next/font/google";

import { CompactFooter, Footer } from "@/components/site/footer";
import { FooterGate } from "@/components/site/footer-gate";
import { Navbar } from "@/components/site/navbar";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ variable: "--font-atkinson-mono", subsets: ["latin"] });
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "NazarAI: Diabetic Retinopathy Screening", template: "%s · NazarAI" },
  description:
    "AI-assisted diabetic retinopathy screening and referral support for Pakistan: quality check, grading, Grad-CAM explanation and Urdu/English patient reports.",
  applicationName: "NazarAI",
};

export const viewport: Viewport = { themeColor: "#060708", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${atkinson.variable} ${atkinsonMono.variable} ${nastaliq.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        <TooltipProvider delayDuration={150}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Suspense fallback={<CompactFooter />}>
            <FooterGate full={<Footer />} compact={<CompactFooter />} />
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
