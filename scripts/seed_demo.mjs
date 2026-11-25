// Create (or update) the demo clinic and one account per role. Synthetic data only.
//
//   cd frontend && node --env-file=.env.local ../scripts/seed_demo.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD (>= 10 chars,
// letters + digits). Idempotent: re-running resets the demo passwords and roles.
// Patients are created WITHOUT screenings: every screening must come from a real model run.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (!password || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  throw new Error("Set DEMO_PASSWORD (>= 10 characters, with letters and digits)");
}
const domain = process.env.DEMO_EMAIL_DOMAIN ?? "demo.nazarai.app";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const CLINIC = { name: "NazarAI Demo Diabetes Clinic", city: "Islamabad" };
const ACCOUNTS = [
  { role: "operator", name: "Ayesha Khan (demo)", email: `health.worker@${domain}` },
  { role: "specialist", name: "Dr. Bilal Ahmed (demo)", email: `eye.specialist@${domain}` },
  { role: "admin", name: "Sana Malik (demo)", email: `clinic.admin@${domain}` },
  { role: "patient", name: "Imran Ali (demo)", email: `patient@${domain}` },
];
const PATIENTS = [
  { mrn: "DEMO-1001", full_name: "Imran Ali", birth_year: 1966, sex: "male", diabetes_type: "type2", diabetes_since_year: 2009 },
  { mrn: "DEMO-1002", full_name: "Nasreen Bibi", birth_year: 1972, sex: "female", diabetes_type: "type2", diabetes_since_year: 2015 },
  { mrn: "DEMO-1003", full_name: "Tariq Mehmood", birth_year: 1958, sex: "male", diabetes_type: "type2", diabetes_since_year: 2001 },
  { mrn: "DEMO-1004", full_name: "Fatima Zahra", birth_year: 1985, sex: "female", diabetes_type: "type1", diabetes_since_year: 1997 },
  { mrn: "DEMO-1005", full_name: "Rashid Hussain", birth_year: 1970, sex: "male", diabetes_type: "type2", diabetes_since_year: 2018 },
];

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

let clinic = (await must(db.from("clinics").select("id").eq("name", CLINIC.name).limit(1), "find clinic"))[0];
clinic ??= await must(db.from("clinics").insert(CLINIC).select("id").single(), "create clinic");
console.log("clinic", clinic.id);

const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) existing.set(u.email, u.id);
  if (data.users.length < 200) break;
}

const ids = {};
for (const a of ACCOUNTS) {
  let id = existing.get(a.email);
  if (id) {
    await must(db.auth.admin.updateUserById(id, { password, email_confirm: true, user_metadata: { full_name: a.name } }), `update ${a.email}`);
  } else {
    id = (await must(db.auth.admin.createUser({ email: a.email, password, email_confirm: true, user_metadata: { full_name: a.name } }), `create ${a.email}`)).user.id;
  }
  await must(
    db.from("profiles").update({
      full_name: a.name,
      role: a.role,
      clinic_id: a.role === "patient" ? null : clinic.id,
      is_active: true,
      must_change_password: false,
    }).eq("id", id),
    `profile ${a.email}`,
  );
  ids[a.role] = id;
  console.log(`${a.role.padEnd(10)} ${a.email}`);
}

for (const p of PATIENTS) {
  const found = (await must(db.from("patients").select("id").eq("clinic_id", clinic.id).eq("mrn", p.mrn).limit(1), "find patient"))[0];
  if (!found) await must(db.from("patients").insert({ ...p, clinic_id: clinic.id, created_by: ids.operator }), `patient ${p.mrn}`);
}
// The demo patient account owns the first demo record (as if they had used an access code).
await must(db.from("patients").update({ user_id: ids.patient }).eq("clinic_id", clinic.id).eq("mrn", "DEMO-1001"), "link demo patient");

console.log(`\n${PATIENTS.length} synthetic patients ready. For the sign-in page's demo buttons set:`);
console.log(`DEMO_ACCOUNTS="${ACCOUNTS.filter((a) => a.role !== "admin").map((a) => `${a.role === "operator" ? "Health worker" : a.role === "specialist" ? "Eye specialist" : "Patient"}|${a.email}|<DEMO_PASSWORD>`).join(";")}"`);
