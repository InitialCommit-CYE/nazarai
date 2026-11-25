#!/usr/bin/env node
/**
 * End-to-end smoke test against a running NazarAI deployment (local or production).
 *
 *   BASE_URL=https://nazarai.vercel.app SUPABASE_PUBLISHABLE_KEY=sb_publishable_... node scripts/smoke-e2e.mjs
 *
 * For every bundled demo image: signed upload -> /api/screen -> report (en + ur) -> PDF ->
 * appears in /api/queue. The unsuitable image must be rejected and never graded.
 * Creates real screening rows (demo references SMOKE-xxxx). Exit code 1 on any failure.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
let failures = 0;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};

const check = (cond, good, bad = good) => (cond ? ok(good) : fail(bad));

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? res.statusText}`);
  return body;
}

async function screen(file, expectOk) {
  const bytes = await readFile(join(here, "..", "public", "demo", file));
  const sign = await json(
    await fetch(`${BASE}/api/uploads/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "image/jpeg", size: bytes.length }),
    }),
  );
  const form = new FormData();
  form.append("cacheControl", "60");
  form.append("", new Blob([bytes], { type: "image/jpeg" }), file);
  const put = await fetch(sign.signedUrl, { method: "PUT", body: form, headers: { apikey: KEY, "x-upsert": "false" } });
  if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`);
  ok(`uploaded ${file} via signed URL`);

  const t0 = Date.now();
  const res = await json(
    await fetch(`${BASE}/api/screen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadPath: sign.path, imageSource: "sample", demoPatientCode: `SMOKE-${Math.floor(Math.random() * 9000 + 1000)}` }),
    }),
  );
  const s = res.screening;
  const took = ((Date.now() - t0) / 1000).toFixed(1);
  if (s.quality_ok !== expectOk) return fail(`${file}: quality_ok=${s.quality_ok}, expected ${expectOk}`);
  if (!expectOk) {
    check(s.grade === null, `${file}: rejected by quality gate, not graded (${took}s)`, `${file}: rejected image was graded`);
    return s;
  }
  ok(`${file}: grade ${s.grade} (${s.grade_label}), ${s.urgency}, confidence ${s.confidence}, model ${s.model_version} (${took}s)`);
  if (!s.model_trained) fail("model_trained=false: the deployment is serving the untrained pipeline-test model");
  check(res.images?.heatmap, "Grad-CAM heatmap returned", "no Grad-CAM heatmap returned");

  for (const language of ["en", "ur"]) {
    const r = await json(
      await fetch(`${BASE}/api/reports/${s.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language }) }),
    );
    check(r.body?.length > 40, `report ${language}: ${r.generator}${r.llm_model ? ` (${r.llm_model})` : ""}, ${r.body.length} chars`, `report ${language} empty`);
  }
  const pdf = await fetch(`${BASE}/api/reports/${s.id}/pdf?lang=ur`);
  const head = new Uint8Array(await pdf.arrayBuffer()).slice(0, 5);
  check(pdf.ok && new TextDecoder().decode(head) === "%PDF-", "PDF referral slip (ur) downloaded", `PDF failed (${pdf.status})`);
  return s;
}

console.log(`NazarAI smoke test against ${BASE}\n`);
try {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  for (const [k, v] of Object.entries(health.checks)) check(v.ok, `health ${k}${v.detail ? `: ${v.detail}` : ""}`);

  const manifest = JSON.parse(await readFile(join(here, "..", "public", "demo", "manifest.json"), "utf8"));
  const ids = [];
  for (const img of manifest.images) {
    console.log(`\n${img.id}`);
    try {
      const s = await screen(img.file, img.expected_quality_ok);
      if (s) ids.push(s.id);
    } catch (e) {
      fail(`${img.file}: ${e.message}`);
    }
  }
  console.log("\nqueue");
  const q = await json(await fetch(`${BASE}/api/queue?scope=today`));
  const missing = ids.filter((id) => !q.items.some((i) => i.id === id));
  check(missing.length === 0, `all ${ids.length} screenings present in today's queue`, `${missing.length} screenings missing from queue`);
  const ranks = q.items.filter((i) => i.quality_ok).map((i) => ({ urgent: 0, refer: 1, routine: 2 })[i.urgency]);
  check(ranks.every((r, i) => i === 0 || ranks[i - 1] <= r), "queue sorted by urgency", "queue not sorted by urgency");
  const m = await json(await fetch(`${BASE}/api/metrics`));
  ok(`metrics status: ${m.status}`);
} catch (e) {
  fail(`fatal: ${e.message}`);
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
