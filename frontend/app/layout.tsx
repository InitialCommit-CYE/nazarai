import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader, Noto_Nastaliq_Urdu } from "next/font/google";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "NazarAI: Diabetic Retinopathy Screening", template: "%s · NazarAI" },
  description:
    "AI-assisted diabetic retinopathy screening and referral support for Pakistan: quality check, grading, Grad-CAM explanation and Urdu/English patient reports.",
  applicationName: "NazarAI",
};

export const viewport: Viewport = { themeColor: "#123b47", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable} ${nastaliq.variable} h-full antialiased`}>
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
          <Footer />
        </TooltipProvider>
      </body>
    </html>
  );
}
