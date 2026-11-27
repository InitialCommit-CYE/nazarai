// Product screenshots for the landing page (public/landing/*.jpg).
// Drives the real UI as the demo health worker (DEMO-1003, sample grade 2) and eye specialist, then deletes the
// screening it created. Re-run after UI changes:  BASE_URL=http://localhost:3100 npm run shots:landing
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(FRONTEND, "public", "landing");
const require = createRequire(join(FRONTEND, "package.json"));
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const MRN = process.env.MRN ?? "DEMO-1003";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const HIDE_DEV_BADGE = "nextjs-portal{display:none!important}";

async function signIn(email, height = 900) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, HIDE_DEV_BADGE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", process.env.DEMO_PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 60000 }), page.click("button[type=submit]")]);
  return page;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

const save = (name) => ({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 86 });

/** Screenshot the full-width band from topLocator to bottomLocator (optionally only x..x+width). */
async function clipBetween(page, name, topLocator, bottomLocator, padTop = 20, padBottom = padTop, x = 0, width = 1280) {
  await topLocator.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120));
  await page.waitForTimeout(300);
  const a = await topLocator.boundingBox();
  const b = await bottomLocator.boundingBox();
  const y = Math.max(0, a.y - padTop);
  await page.screenshot({ ...save(name), clip: { x, y, width, height: b.y + b.height + padBottom - y } });
  console.log("saved", name);
}

let id;
try {
  const { data: patient, error } = await admin.from("patients").select("id").eq("mrn", MRN).single();
  if (error) throw new Error(`patient ${MRN}: ${error.message}`);

  const hw = await signIn("health.worker@demo.nazarai.app", 940);
  await hw.goto(`${BASE}/screen?patient=${patient.id}`);
  await settle(hw);
  await clipBetween(hw, "step-patient", hw.getByRole("list", { name: "Screening steps" }), hw.getByText("Upload or capture a colour fundus photo"), 18, 22, 0, 900);

  await hw.locator('button[data-sample="grade2-moderate"]').first().click();
  await hw.getByText("Choose a different image").waitFor();
  await settle(hw);
  await clipBetween(hw, "step-photo", hw.getByRole("list", { name: "Screening steps" }), hw.getByText("Choose a different image"), 18, 22, 0, 900);

  await hw.getByRole("button", { name: /Run screening/ }).click();
  await hw.waitForURL(/\/screenings\//, { timeout: 120000 });
  id = hw.url().split("/screenings/")[1].split(/[/?#]/)[0];
  await hw.locator("section[aria-labelledby=decision-title]").waitFor();
  await settle(hw);
  // Hero: the whole result screen down to the end of the heatmap card, so the image never cuts through the retina.
  await hw.setViewportSize({ width: 1280, height: 1500 });
  await hw.evaluate(() => window.scrollTo(0, 0));
  await hw.waitForTimeout(500);
  const caption = await hw.getByText(/Grad-CAM overlay|Grad-CAM unavailable/).first().boundingBox();
  await hw.screenshot({ ...save("hero-result"), clip: { x: 0, y: 0, width: 1280, height: Math.round(caption.y + caption.height + 34) } });
  await hw.setViewportSize({ width: 1280, height: 940 });
  console.log("saved hero-result");
  await hw.locator("section[aria-labelledby=decision-title]").screenshot(save("decision"));
  console.log("saved decision");

  await hw.getByRole("link", { name: /Explainability/ }).first().click();
  await hw.locator("figure").first().waitFor();
  await settle(hw);
  await hw.locator("figure").first().screenshot(save("heatmap"));
  console.log("saved heatmap");

  await hw.getByRole("link", { name: /Patient report/ }).first().click();
  await hw.locator("article").first().waitFor();
  await hw.locator('[aria-label="Generating report"]').waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await settle(hw);
  const art = await hw.locator("article").first().boundingBox();
  await hw.screenshot({ ...save("report"), clip: { x: art.x, y: art.y, width: art.width, height: Math.min(art.height, 560) } });
  console.log("saved report");

  const sp = await signIn("eye.specialist@demo.nazarai.app");
  await sp.goto(`${BASE}/queue`);
  await sp.locator("tbody tr").nth(3).waitFor();
  await settle(sp);
  await clipBetween(sp, "worklist", sp.getByText("Open referrals").first(), sp.locator("tbody tr").nth(3), 18, 0);
} finally {
  if (id) {
    const { error } = await admin.from("screenings").delete().eq("id", id);
    console.log(error ? `cleanup failed: ${error.message}` : "cleanup ok");
  }
  await browser.close();
}
