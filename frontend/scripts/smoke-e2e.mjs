#!/usr/bin/env node
/**
 * Authenticated end-to-end screening smoke test against a running NazarAI deployment.
 *
 *   BASE_URL=https://nazarai-jade.vercel.app npm run smoke:e2e     (reads frontend/.env.local)
 *
 * Signs in as the demo health worker (Playwright, Edge), then for every bundled demo image:
 * signed upload -> /api/screen -> temp upload deleted -> report (en + ur) -> Urdu PDF -> result page.
 * The unsuitable image must be rejected and never graded. The demo eye specialist must then see
 * every screening in today's queue, sorted by urgency.
 *
 * Needs DEMO_PASSWORD (npm run seed:demo), NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * and SUPABASE_SERVICE_ROLE_KEY (patient lookup, upload check, cleanup).
 * Deletes its screening rows (and their reports) at the end; KEEP=1 keeps them to fill a demo queue.
 * Exit code 1 on any failure.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(here, "..", "public", "demo");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const D = process.env.DEMO_EMAIL_DOMAIN ?? "demo.nazarai.app"; // same default as scripts/seed_demo.mjs
const PW = process.env.DEMO_PASSWORD;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const KEEP = process.env.KEEP === "1";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, good, bad = good) => (cond ? ok(good) : fail(bad));
const created = [];

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`${res.status()} ${body.error ?? res.statusText()}`);
  return body;
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });

async function signIn(email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 }),
    page.click("button[type=submit]"),
  ]);
  return { ctx, page };
}

async function screen(op, img, patientId) {
  const api = op.ctx.request;
  const bytes = await readFile(join(DEMO_DIR, img.file));
  const sign = await json(await api.post(`${BASE}/api/uploads/sign`, { data: { contentType: "image/jpeg", size: bytes.length } }));
  const form = new FormData();
  form.append("cacheControl", "60");
  form.append("", new Blob([bytes], { type: "image/jpeg" }), img.file);
  const put = await fetch(sign.signedUrl, { method: "PUT", body: form, headers: { apikey: KEY, "x-upsert": "false" } });
  if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`);
  ok("uploaded via signed URL to the private bucket");

  const t0 = Date.now();
  const res = await json(
    await api.post(`${BASE}/api/screen`, { data: { uploadPath: sign.path, imageSource: "sample", patientId }, timeout: 120000 }),
  );
  const s = res.screening;
  created.push(s.id);
  const took = ((Date.now() - t0) / 1000).toFixed(1);

  const name = sign.path.split("/").pop();
  const { data: left } = await admin.storage.from(sign.bucket).list("incoming", { search: name });
  check(!left?.some((o) => o.name === name), "temporary upload deleted after inference", "temporary upload still in the bucket");

  if (s.quality_ok !== img.expected_quality_ok) return fail(`quality_ok=${s.quality_ok}, expected ${img.expected_quality_ok}`);
  if (!img.expected_quality_ok) {
    return check(s.grade === null, `rejected by quality gate, not graded (${took}s)`, "rejected image was graded");
  }
  const note = s.grade === img.reference_grade ? "" : ` (reference grade ${img.reference_grade})`;
  ok(`grade ${s.grade} (${s.grade_label})${note}, ${s.urgency}, confidence ${s.confidence}, ${s.model_version} (${took}s)`);
  check(s.model_trained, "trained model served", "model_trained=false: the untrained pipeline-test model is deployed");
  check(res.images?.heatmap, "Grad-CAM heatmap returned", "no Grad-CAM heatmap returned");

  for (const language of ["en", "ur"]) {
    const r = await json(await api.post(`${BASE}/api/reports/${s.id}`, { data: { language } }));
    check(r.body?.length > 40, `report ${language}: ${r.generator}, ${r.body.length} chars`, `report ${language} empty`);
  }
  const pdf = await api.get(`${BASE}/api/reports/${s.id}/pdf?lang=ur`, { timeout: 60000 });
  const head = (await pdf.body()).subarray(0, 5).toString();
  check(pdf.ok() && head === "%PDF-", "PDF referral slip (ur) downloaded", `PDF failed (${pdf.status()})`);

  const page = await op.ctx.newPage();
  const r = await page.goto(`${BASE}/screenings/${s.id}`);
  check(r?.ok(), "result page renders", `result page returned ${r?.status()}`);
  await page.close();
}

console.log(`NazarAI screening smoke test against ${BASE}\n`);
try {
  if (!PW) throw new Error("DEMO_PASSWORD is not set (run with --env-file=.env.local)");
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  for (const [k, v] of Object.entries(health.checks)) check(v.ok, `health ${k}${v.detail ? `: ${v.detail}` : ""}`);

  const op = await signIn(`health.worker@${D}`, PW);
  ok(`health worker signed in -> ${new URL(op.page.url()).pathname}`);

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const opId = users.users.find((u) => u.email === `health.worker@${D}`)?.id;
  const { data: prof } = await admin.from("profiles").select("clinic_id").eq("id", opId).single();
  const { data: patient, error: pErr } = await admin
    .from("patients")
    .select("id, mrn")
    .eq("clinic_id", prof?.clinic_id)
    .limit(1)
    .single();
  if (pErr || !patient) throw new Error("no patient in the demo clinic (run npm run seed:demo)");
  ok(`screening patient ${patient.mrn}`);

  const manifest = JSON.parse(await readFile(join(DEMO_DIR, "manifest.json"), "utf8"));
  for (const img of manifest.images) {
    console.log(`\n${img.id}`);
    try {
      await screen(op, img, patient.id);
    } catch (e) {
      fail(`${img.file}: ${e.message}`);
    }
  }

  console.log("\nqueue (eye specialist)");
  const sp = await signIn(`eye.specialist@${D}`, PW);
  const q = await json(await sp.ctx.request.get(`${BASE}/api/queue?scope=today`));
  const missing = created.filter((id) => !q.items.some((i) => i.id === id));
  check(missing.length === 0, `all ${created.length} screenings in today's queue`, `${missing.length} screenings missing from the queue`);
  const ranks = q.items.filter((i) => i.quality_ok).map((i) => ({ urgent: 0, refer: 1, routine: 2 })[i.urgency]);
  check(ranks.every((r, i) => i === 0 || ranks[i - 1] <= r), "queue sorted by urgency", "queue not sorted by urgency");
  const qp = await sp.page.goto(`${BASE}/queue`);
  check(qp?.ok(), "queue page renders", `queue page returned ${qp?.status()}`);
} catch (e) {
  fail(`fatal: ${e.message}`);
} finally {
  if (created.length && !KEEP) {
    const { error } = await admin.from("screenings").delete().in("id", created);
    console.log(error ? `\ncleanup failed: ${error.message}` : `\ncleanup: deleted ${created.length} test screenings and their reports`);
  } else if (created.length) {
    console.log(`\nKEEP=1: left ${created.length} screenings in the queue`);
  }
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
