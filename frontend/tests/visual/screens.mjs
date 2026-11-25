// Screenshot pages at phone / tablet / desktop widths and flag horizontal overflow.
//   BASE_URL=http://localhost:3100 OUT=../screens node tests/visual/screens.mjs [/path ...]
// Optional sign-in: EMAIL / PASSWORD env vars (uses the real sign-in form).
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "screens";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/about", "/performance", "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const problems = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  if (process.env.EMAIL) {
    await page.goto(`${BASE}/auth/sign-in`);
    await page.fill("#email", process.env.EMAIL);
    await page.fill("#password", process.env.PASSWORD ?? "");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 }), page.click("button[type=submit]")]);
  }
  for (const p of paths) {
    errors.length = 0;
    const res = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const file = join(OUT, `${vp.name}${p.replace(/[/?=&]+/g, "_") || "_home"}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const status = res?.status();
    const line = `${vp.name.padEnd(8)} ${String(status).padEnd(4)} ${p.padEnd(28)} overflow=${overflow}px errors=${errors.length}`;
    console.log(line + (errors.length ? `  ${errors.slice(0, 2).join(" | ").slice(0, 200)}` : ""));
    if (overflow > 0 || errors.length || (status ?? 500) >= 400) problems.push(line);
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nno layout overflow, console errors or failed loads");
