// End-to-end role flows against a running app + real Supabase project (synthetic demo clinic).
//   BASE_URL=http://localhost:3100 node --env-file=.env.local tests/e2e/flows.mjs
// Needs DEMO_PASSWORD, DEMO_ADMIN_PASSWORD (npm run seed:demo) and SUPABASE_SERVICE_ROLE_KEY (cleanup only).
import assert from "node:assert/strict";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const D = process.env.DEMO_EMAIL_DOMAIN ?? "demo.nazarai.app"; // same default as scripts/seed_demo.mjs
const PW = process.env.DEMO_PASSWORD;
const ADMIN_PW = process.env.DEMO_ADMIN_PASSWORD;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36).toUpperCase();
const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (e) {
    results.push(`FAIL  ${name}: ${(e?.message ?? e).toString().split("\n")[0].slice(0, 200)}`);
  }
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
async function session(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 }), page.click("button[type=submit]")]);
  return { ctx, page };
}

let code = null;
let createdPatientMrn = `E2E-${stamp}`;
let staffEmail = `e2e.staff.${stamp.toLowerCase()}@${D}`;

// ---------------------------------------------------------------- anonymous
await step("signed-out visitor is sent to sign-in from a protected page", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/patients`);
  await page.waitForURL(/\/auth\/sign-in/);
  assert.match(page.url(), /next=%2Fpatients/);
  await ctx.close();
});

await step("wrong password shows a generic error", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill("#email", `health.worker@${D}`);
  await page.fill("#password", "definitely-wrong-1");
  await page.click("button[type=submit]");
  await page.getByText("Incorrect email or password.").waitFor();
  await ctx.close();
});

// ---------------------------------------------------------------- operator
const op = await session(`health.worker@${D}`, PW);
await step("operator lands on the dashboard with clinic stats", async () => {
  assert.match(op.page.url(), /\/dashboard/);
  await op.page.getByText("Registered patients").waitFor();
});

await step("operator searches patients (debounced, server-side)", async () => {
  await op.page.goto(`${BASE}/patients`);
  await op.page.getByLabel("Search patients").fill("Nasreen");
  await op.page.waitForURL(/q=Nasreen/);
  await op.page.locator("table").getByText("Nasreen Bibi").waitFor();
  assert.equal(await op.page.locator("table").getByText("Tariq Mehmood").count(), 0);
});

await step("operator registers a patient (validation, then success)", async () => {
  await op.page.goto(`${BASE}/patients/new`);
  await op.page.fill("#fullName", "E2E Test Patient");
  await op.page.fill("#mrn", createdPatientMrn);
  await op.page.fill("#birthYear", "1890");
  await op.page.getByRole("button", { name: "Save patient" }).click();
  await op.page.getByText("Enter a valid birth year.").waitFor();
  await op.page.fill("#birthYear", "1975");
  await op.page.fill("#diabetesSinceYear", "2010");
  await op.page.getByRole("button", { name: "Save patient" }).click();
  await op.page.waitForURL(/\/patients\/[0-9a-f-]{36}\?created=1/);
  await op.page.getByText("Patient registered.").waitFor();
});

await step("duplicate clinic reference is rejected", async () => {
  await op.page.goto(`${BASE}/patients/new`);
  await op.page.fill("#fullName", "Duplicate Ref");
  await op.page.fill("#mrn", createdPatientMrn);
  await op.page.fill("#birthYear", "1980");
  await op.page.getByRole("button", { name: "Save patient" }).click();
  await op.page.getByText("Another patient in your clinic already has this reference number.").waitFor();
});

await step("operator edits the patient", async () => {
  await op.page.goto(`${BASE}/patients?q=${createdPatientMrn}`);
  await op.page.locator("table").getByText("E2E Test Patient").click();
  await op.page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
  await op.page.getByRole("link", { name: "Edit" }).click();
  await op.page.fill("#phone", "+92 300 1234567");
  await op.page.getByRole("button", { name: "Save changes" }).click();
  await op.page.getByText("Changes saved.").waitFor();
});

await step("operator issues a one-time patient access code (for DEMO-1002)", async () => {
  const { data } = await admin.from("patients").select("id").eq("mrn", "DEMO-1002").single();
  await op.page.goto(`${BASE}/patients/${data.id}`);
  await op.page.getByRole("button", { name: "Patient access code" }).click();
  await op.page.getByRole("button", { name: "Create code" }).click();
  const el = op.page.locator("span.font-mono.text-2xl");
  await el.waitFor();
  code = (await el.textContent())?.trim();
  assert.match(code ?? "", /^[A-HJ-NP-Z2-9]{8}$/);
  await op.page.getByRole("button", { name: "Done" }).click();
});

await step("operator cannot open admin pages", async () => {
  await op.page.goto(`${BASE}/admin/staff`);
  await op.page.waitForURL(/\/dashboard/);
});

await step("operator deletes the test patient after confirming", async () => {
  await op.page.goto(`${BASE}/patients?q=${createdPatientMrn}`);
  await op.page.locator("table").getByText("E2E Test Patient").click();
  await op.page.getByRole("button", { name: "Delete" }).click();
  await op.page.getByRole("button", { name: "Delete permanently" }).click();
  await op.page.waitForURL(/\/patients\?deleted=1/);
  const { data } = await admin.from("patients").select("id").eq("mrn", createdPatientMrn);
  assert.equal(data.length, 0);
});
await op.ctx.close();

// ---------------------------------------------------------------- patient
const pt = await session(`patient@${D}`, PW);
await step("patient lands on My results and cannot open staff pages", async () => {
  assert.match(pt.page.url(), /\/my/);
  await pt.page.goto(`${BASE}/patients`);
  await pt.page.waitForURL(/\/my$/);
});
await step("wrong birth year does not link a record", async () => {
  await pt.page.goto(`${BASE}/my/link`);
  await pt.page.fill("#code", code ?? "AAAAAAAA");
  await pt.page.fill("#birthYear", "1999");
  await pt.page.getByRole("button", { name: "Link my record" }).click();
  await pt.page.getByText("do not match a record").waitFor();
});
await step("correct code + birth year links the record", async () => {
  await pt.page.fill("#code", code ?? "");
  await pt.page.fill("#birthYear", "1972");
  await pt.page.getByRole("button", { name: "Link my record" }).click();
  await pt.page.waitForURL(/\/my\?linked=1/);
  await pt.page.getByText("Your clinic record is now linked").waitFor();
});
await pt.ctx.close();
await admin.from("patients").update({ user_id: null }).eq("mrn", "DEMO-1002"); // restore demo data

// ---------------------------------------------------------------- admin
const ad = await session(`clinic.admin@${D}`, ADMIN_PW);
let tempPassword = null;
await step("admin creates a staff account and gets a temporary password", async () => {
  await ad.page.goto(`${BASE}/admin/staff`);
  await ad.page.fill("#fullName", "E2E Staff Member");
  await ad.page.fill("#email", staffEmail);
  await ad.page.selectOption("#role", "specialist");
  await ad.page.getByRole("button", { name: "Create account" }).click();
  await ad.page.getByText("Account created for E2E Staff Member.").waitFor();
  tempPassword = (await ad.page.locator("span.font-mono.font-semibold").textContent())?.trim();
  assert.ok(tempPassword && tempPassword.length >= 14);
});
await step("admin cannot open patient records", async () => {
  await ad.page.goto(`${BASE}/patients`);
  await ad.page.waitForURL(/\/dashboard/);
});
await step("audit log shows the staff creation", async () => {
  await ad.page.goto(`${BASE}/admin/audit?entity=profile`);
  await ad.page.getByText("created a staff account").first().waitFor();
});
await ad.ctx.close();

await step("new staff member must change the temporary password at first sign-in", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill("#email", staffEmail);
  await page.fill("#password", tempPassword ?? "");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/settings\?change_password=1/);
  await page.goto(`${BASE}/queue`);
  await page.waitForURL(/\/settings\?change_password=1/);
  await page.fill("#password", `NewPass${stamp}9x`);
  await page.fill("#confirm", `NewPass${stamp}9x`);
  await page.getByRole("button", { name: "Save new password" }).click();
  await page.waitForURL(/\/dashboard/);
  await ctx.close();
});

// cleanup: remove the e2e staff account
const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
for (const u of users.users.filter((u) => u.email === staffEmail)) await admin.auth.admin.deleteUser(u.id);

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
