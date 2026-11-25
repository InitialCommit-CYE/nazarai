// Row Level Security tests: run the real migrations in an embedded Postgres (PGlite) with minimal
// stand-ins for Supabase's auth/storage/realtime schemas, then act as each role.
// Run: npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "..", "supabase", "migrations");

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create schema realtime;
create function realtime.send(jsonb, text, text, boolean) returns void language sql as $$ select $$;
`;

const ids = {
  clinicA: "a0000000-0000-4000-8000-000000000001",
  clinicB: "b0000000-0000-4000-8000-000000000001",
  adminA: "a0000000-0000-4000-8000-0000000000ad",
  operatorA: "a0000000-0000-4000-8000-00000000000a",
  specialistA: "a0000000-0000-4000-8000-00000000005b",
  operatorB: "b0000000-0000-4000-8000-00000000000b",
  adminB: "b0000000-0000-4000-8000-0000000000ad",
  patientUser: "c0000000-0000-4000-8000-00000000000c",
  otherPatientUser: "c0000000-0000-4000-8000-00000000000d",
};

let db;

/** Run SQL as a signed-in user (role authenticated + JWT subject), or as anon when uid is null. */
async function as(uid, sql, params = []) {
  await db.exec("reset role");
  if (uid) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec("set role authenticated");
  } else {
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("set role anon");
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

/** Run SQL as the server (service role bypasses RLS, like supabaseAdmin()). */
async function asService(sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function denied(promise, pattern = /permission denied|violates row-level security|not allowed|not found/) {
  await assert.rejects(promise, pattern);
}

async function createUser(id, email, meta = {}) {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, meta]);
}

async function makeStaff(id, role, clinic) {
  await db.query("update public.profiles set role = $2, clinic_id = $3 where id = $1", [id, role, clinic]);
}

async function insertScreening(clinic, patient, by, urgency = "urgent", grade = 3) {
  const referable = urgency !== "routine";
  const { rows } = await asService(
    `insert into public.screenings (clinic_id, patient_id, created_by, quality_ok, grade, grade_label, continuous_score,
       confidence, referable, urgency, borderline, model_version, model_trained)
     values ($1, $2, $3, true, $4, 'Severe NPDR', 3.1, 0.8, $5, $6, false, 'test', true) returning id`,
    [clinic, patient, by, grade, referable, urgency],
  );
  return rows[0].id;
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  await db.exec(`grant all on all tables in schema public to service_role;`);

  await db.query("insert into public.clinics (id, name) values ($1, 'Clinic A'), ($2, 'Clinic B')", [ids.clinicA, ids.clinicB]);
  for (const [k, id] of Object.entries(ids)) if (!k.startsWith("clinic")) await createUser(id, `${k}@example.test`);
  await makeStaff(ids.adminA, "admin", ids.clinicA);
  await makeStaff(ids.operatorA, "operator", ids.clinicA);
  await makeStaff(ids.specialistA, "specialist", ids.clinicA);
  await makeStaff(ids.operatorB, "operator", ids.clinicB);
  await makeStaff(ids.adminB, "admin", ids.clinicB);
});

describe("sign-up and profiles", () => {
  test("sign-up metadata can never grant a staff role", async () => {
    const id = "d0000000-0000-4000-8000-000000000001";
    await createUser(id, "sneaky@example.test", { full_name: "Sneaky", role: "admin", clinic_id: ids.clinicA });
    const { rows } = await db.query("select role, clinic_id, full_name from public.profiles where id = $1", [id]);
    assert.deepEqual(rows[0], { role: "patient", clinic_id: null, full_name: "Sneaky" });
  });

  test("users cannot change their own role, clinic or active flag", async () => {
    await denied(as(ids.patientUser, "update public.profiles set role = 'admin' where id = auth.uid()"));
    await denied(as(ids.operatorA, "update public.profiles set clinic_id = $1 where id = auth.uid()", [ids.clinicB]));
    await denied(as(ids.operatorA, "update public.profiles set is_active = false where id = auth.uid()"));
  });

  test("users can edit their own display name only", async () => {
    await as(ids.operatorA, "update public.profiles set full_name = 'Op A' where id = auth.uid()");
    const r = await as(ids.operatorA, "update public.profiles set full_name = 'X' where id = $1 returning id", [ids.specialistA]);
    assert.equal(r.rows.length, 0);
  });

  test("patients see only their own profile; staff see colleagues of their clinic only", async () => {
    const p = await as(ids.patientUser, "select id from public.profiles");
    assert.deepEqual(p.rows.map((r) => r.id), [ids.patientUser]);
    const s = await as(ids.operatorA, "select id from public.profiles");
    assert.ok(s.rows.every((r) => [ids.adminA, ids.operatorA, ids.specialistA].includes(r.id)));
    assert.equal(s.rows.length, 3);
  });
});

describe("anonymous visitors", () => {
  for (const t of ["clinics", "profiles", "patients", "screenings", "screening_reports", "notifications", "audit_log"]) {
    test(`anon cannot read ${t}`, async () => {
      await denied(as(null, `select 1 from public.${t} limit 1`));
    });
  }
  test("anon cannot call RPCs", async () => {
    await denied(as(null, "select public.clinic_stats(30)"));
    await denied(as(null, "select public.claim_patient_record('AAAAAAAA', 1970)"));
  });
});

describe("patients (clinic isolation)", () => {
  let patientA;

  test("an operator can create a patient in their own clinic", async () => {
    const { rows } = await as(
      ids.operatorA,
      `insert into public.patients (clinic_id, mrn, full_name, birth_year, created_by)
       values ($1, 'MRN-1', 'Test Patient', 1970, auth.uid()) returning id`,
      [ids.clinicA],
    );
    patientA = rows[0].id;
    assert.ok(patientA);
  });

  test("an operator cannot create patients in another clinic or on behalf of someone else", async () => {
    await denied(as(ids.operatorA, `insert into public.patients (clinic_id, mrn, full_name, birth_year, created_by)
      values ($1, 'MRN-2', 'Other', 1970, auth.uid())`, [ids.clinicB]));
    await denied(as(ids.operatorA, `insert into public.patients (clinic_id, mrn, full_name, birth_year, created_by)
      values ($1, 'MRN-3', 'Other', 1970, $2)`, [ids.clinicA, ids.specialistA]));
  });

  test("other clinics, admins and unrelated patients cannot see the record", async () => {
    for (const uid of [ids.operatorB, ids.adminA, ids.adminB, ids.patientUser]) {
      const { rows } = await as(uid, "select id from public.patients where id = $1", [patientA]);
      assert.equal(rows.length, 0, `user ${uid} must not see the patient`);
    }
  });

  test("other clinics cannot update or delete the record", async () => {
    const u = await as(ids.operatorB, "update public.patients set full_name = 'Hacked' where id = $1 returning id", [patientA]);
    assert.equal(u.rows.length, 0);
    const d = await as(ids.operatorB, "delete from public.patients where id = $1 returning id", [patientA]);
    assert.equal(d.rows.length, 0);
  });

  test("staff cannot read the access-code hash or set the linked account directly", async () => {
    await denied(as(ids.operatorA, "select access_code_hash from public.patients"));
    await denied(as(ids.operatorA, "update public.patients set user_id = $2 where id = $1", [patientA, ids.patientUser]));
  });

  test("screenings: browsers can never write AI results", async () => {
    await denied(as(ids.operatorA, `insert into public.screenings (clinic_id, quality_ok, model_version, model_trained)
      values ($1, false, 'x', true)`, [ids.clinicA]));
    const sid = await insertScreening(ids.clinicA, patientA, ids.operatorA);
    await denied(as(ids.specialistA, "update public.screenings set grade = 0, urgency = 'routine' where id = $1", [sid]));
    await denied(as(ids.operatorA, "delete from public.screenings where id = $1", [sid]));
  });

  test("a referable screening notifies the clinic's specialists and appears only in its clinic", async () => {
    const sid = await insertScreening(ids.clinicA, patientA, ids.operatorA);
    const n = await as(ids.specialistA, "select link from public.notifications where kind = 'referral'");
    assert.ok(n.rows.some((r) => r.link === `/screenings/${sid}`));
    assert.equal((await as(ids.operatorA, "select id from public.screenings where id = $1", [sid])).rows.length, 1);
    for (const uid of [ids.operatorB, ids.adminA, ids.patientUser]) {
      assert.equal((await as(uid, "select id from public.screenings where id = $1", [sid])).rows.length, 0);
    }
    const st = (await as(ids.operatorA, "select referral_status from public.screenings where id = $1", [sid])).rows[0];
    assert.equal(st.referral_status, "pending");
  });

  test("referral follow-up: specialists add notes, operators only change status, other clinics nothing", async () => {
    const sid = await insertScreening(ids.clinicA, patientA, ids.operatorA);
    await assert.rejects(as(ids.operatorA, "select public.review_screening($1, 'seen', null, 'note')", [sid]), /only specialists/);
    await as(ids.operatorA, "select public.review_screening($1, 'scheduled', now() + interval '2 days', null)", [sid]);
    await as(ids.specialistA, "select public.review_screening($1, 'seen', null, 'Laser planned')", [sid]);
    const r = (await as(ids.operatorA, "select referral_status, specialist_note, reviewed_by from public.screenings where id = $1", [sid])).rows[0];
    assert.deepEqual(r, { referral_status: "seen", specialist_note: "Laser planned", reviewed_by: ids.specialistA });
    await denied(as(ids.operatorB, "select public.review_screening($1, 'closed', null, null)", [sid]));
    const routine = await insertScreening(ids.clinicA, patientA, ids.operatorA, "routine", 0);
    await assert.rejects(as(ids.specialistA, "select public.review_screening($1, 'seen', null, null)", [routine]), /does not need a referral/);
  });

  test("patient account linking with a one-time code (birth year must match, attempts limited)", async () => {
    const sid = await insertScreening(ids.clinicA, patientA, ids.operatorA);
    await asService("insert into public.screening_reports (screening_id, language, body, generator) values ($1, 'en', 'Report', 'template')", [sid]);
    await denied(as(ids.operatorB, "select public.issue_patient_access_code($1)", [patientA]));
    const code = (await as(ids.operatorA, "select public.issue_patient_access_code($1) as c", [patientA])).rows[0].c;
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);

    const wrong = (await as(ids.patientUser, "select public.claim_patient_record($1, 1971) as r", [code])).rows[0].r;
    assert.equal(wrong, "invalid");
    const staffClaim = (await as(ids.operatorA, "select public.claim_patient_record($1, 1970) as r", [code])).rows[0].r;
    assert.equal(staffClaim, "not_patient");
    const ok = (await as(ids.patientUser, "select public.claim_patient_record($1, 1970) as r", [code.toLowerCase()])).rows[0].r;
    assert.equal(ok, "linked");

    assert.equal((await as(ids.patientUser, "select id from public.patients")).rows.length, 1);
    assert.ok((await as(ids.patientUser, "select id from public.screenings where id = $1", [sid])).rows.length === 1);
    assert.equal((await as(ids.patientUser, "select body from public.screening_reports where screening_id = $1", [sid])).rows[0].body, "Report");
    assert.equal((await as(ids.patientUser, "select name from public.clinics")).rows[0].name, "Clinic A");
    assert.equal((await as(ids.otherPatientUser, "select id from public.screenings")).rows.length, 0);
    assert.equal((await as(ids.otherPatientUser, "select id from public.clinics")).rows.length, 0);

    const reuse = (await as(ids.otherPatientUser, "select public.claim_patient_record($1, 1970) as r", [code])).rows[0].r;
    assert.equal(reuse, "invalid", "a used code cannot be claimed again");
    const edit = await as(ids.patientUser, "update public.patients set full_name = 'Me' where id = $1 returning id", [patientA]);
    assert.equal(edit.rows.length, 0, "patients cannot edit their clinical record");
  });

  test("brute force: the 6th failed claim in an hour is refused", async () => {
    for (let i = 0; i < 4; i++) await as(ids.otherPatientUser, "select public.claim_patient_record('AAAAAAAA', 1970)");
    const r = (await as(ids.otherPatientUser, "select public.claim_patient_record('BBBBBBBB', 1970) as r")).rows[0].r;
    assert.equal(r, "too_many_attempts");
  });

  test("record access and changes are audited; only the clinic admin can read the log", async () => {
    await as(ids.operatorA, "select public.log_record_access('patient', $1)", [patientA]);
    await as(ids.operatorA, "update public.patients set phone = '+92 300 1234567' where id = $1", [patientA]);
    const log = await as(ids.adminA, "select action, details from public.audit_log where entity_id = $1 order by id", [patientA]);
    const actions = log.rows.map((r) => r.action);
    for (const a of ["patient.create", "patient.view", "patient.update", "patient.access_code_issued", "patient.account_linked"]) {
      assert.ok(actions.includes(a), `missing ${a} in ${actions}`);
    }
    assert.ok(!JSON.stringify(log.rows).includes("1234567"), "audit details must not contain patient data");
    assert.equal((await as(ids.adminB, "select id from public.audit_log where entity_id = $1", [patientA])).rows.length, 0);
    assert.equal((await as(ids.operatorA, "select id from public.audit_log")).rows.length, 0);
  });

  test("the audit log is append-only for browsers and cannot be forged", async () => {
    await denied(as(ids.adminA, "delete from public.audit_log"));
    await denied(as(ids.adminA, "update public.audit_log set action = 'x'"));
    await denied(as(ids.adminA, "insert into public.audit_log (action, entity) values ('x', 'patient')"));
    await denied(as(ids.adminA, "select private.audit('x', 'patient', null, null)"));
  });

  test("deleting a patient removes their screenings and is audited", async () => {
    const { rows } = await as(ids.operatorA, `insert into public.patients (clinic_id, mrn, full_name, birth_year, created_by)
      values ($1, 'MRN-DEL', 'To Delete', 1980, auth.uid()) returning id`, [ids.clinicA]);
    const pid = rows[0].id;
    const sid = await insertScreening(ids.clinicA, pid, ids.operatorA);
    await as(ids.operatorA, "delete from public.patients where id = $1", [pid]);
    assert.equal((await asService("select id from public.screenings where id = $1", [sid])).rows.length, 0);
    const a = await as(ids.adminA, "select action from public.audit_log where entity_id = $1 and action = 'patient.delete'", [pid]);
    assert.equal(a.rows.length, 1);
  });
});

describe("clinic administration", () => {
  test("admins manage staff of their own clinic only, never themselves", async () => {
    await as(ids.adminA, "select public.admin_update_member($1, 'specialist', true)", [ids.operatorA]);
    assert.equal((await db.query("select role from public.profiles where id = $1", [ids.operatorA])).rows[0].role, "specialist");
    await as(ids.adminA, "select public.admin_update_member($1, 'operator', true)", [ids.operatorA]);
    await assert.rejects(as(ids.adminA, "select public.admin_update_member($1, 'operator', true)", [ids.adminA]), /your own/);
    await denied(as(ids.adminA, "select public.admin_update_member($1, 'admin', true)", [ids.operatorB]));
    await denied(as(ids.operatorA, "select public.admin_update_member($1, 'admin', true)", [ids.specialistA]));
    await denied(as(ids.adminA, "select public.admin_update_member($1, 'operator', true)", [ids.patientUser]));
  });

  test("deactivated staff lose access immediately", async () => {
    await as(ids.adminA, "select public.admin_update_member($1, 'specialist', false)", [ids.specialistA]);
    assert.equal((await as(ids.specialistA, "select id from public.patients")).rows.length, 0);
    assert.equal((await as(ids.specialistA, "select id from public.screenings")).rows.length, 0);
    await as(ids.adminA, "select public.admin_update_member($1, 'specialist', true)", [ids.specialistA]);
    assert.ok((await as(ids.specialistA, "select id from public.screenings")).rows.length > 0);
  });

  test("clinic stats are aggregate-only and limited to staff", async () => {
    const s = (await as(ids.adminA, "select public.clinic_stats(30) as s")).rows[0].s;
    assert.ok(s.screenings >= 1 && s.patients >= 1 && Array.isArray(s.daily));
    await denied(as(ids.patientUser, "select public.clinic_stats(30)"));
  });
});

describe("notifications", () => {
  test("users read and mark only their own notifications", async () => {
    const linked = (await asService("select id from public.patients where user_id = $1", [ids.patientUser])).rows[0].id;
    await insertScreening(ids.clinicA, linked, ids.operatorA);
    const mine = await as(ids.patientUser, "select kind, link from public.notifications");
    assert.ok(mine.rows.some((r) => r.kind === "result" && r.link === "/my"), "a linked patient is told when a result is ready");
    const before = (await as(ids.specialistA, "select count(*)::int as n from public.notifications where read_at is null")).rows[0].n;
    await as(ids.patientUser, "select public.mark_notifications_read(null)");
    const after = (await as(ids.specialistA, "select count(*)::int as n from public.notifications where read_at is null")).rows[0].n;
    assert.equal(after, before, "marking your own notifications must not touch others'");
    assert.equal((await as(ids.patientUser, "select id from public.notifications where read_at is null")).rows.length, 0);
    await denied(as(ids.patientUser, "insert into public.notifications (user_id, kind, title) values (auth.uid(), 'account', 'x')"));
  });
});

describe("latest-screening view", () => {
  test("respects RLS of the underlying table", async () => {
    const a = await as(ids.operatorA, "select patient_id from public.patient_latest_screening");
    assert.ok(a.rows.length >= 1);
    assert.equal((await as(ids.operatorB, "select patient_id from public.patient_latest_screening")).rows.length, 0);
    assert.equal((await as(ids.adminA, "select patient_id from public.patient_latest_screening")).rows.length, 0);
    await denied(as(null, "select 1 from public.patient_latest_screening"));
  });
});
