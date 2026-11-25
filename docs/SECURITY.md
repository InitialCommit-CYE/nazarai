# Security and privacy model

NazarAI handles patient records, so access control lives in the **database**, not the UI. Even a bug in a page
or a hand-crafted request with a valid session can only reach rows that Postgres Row Level Security (RLS) allows.

## Roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| `operator` | Health worker / nurse | Register, edit, delete patients of **their clinic**; run screenings; book appointments; issue patient access codes | See other clinics; write or change AI results; add clinical notes |
| `specialist` | Ophthalmologist | Everything an operator can, plus clinical notes on referrals | See other clinics; change AI results |
| `admin` | Clinic administrator | Create staff accounts (temporary password), change roles, deactivate staff, reset staff passwords, read clinic totals and the audit log | Open patient records, screenings or reports (deliberately excluded); change their own role or status |
| `patient` | Person with diabetes | Read their own linked records, results, reports, appointments, specialist notes | Edit anything clinical; see anyone else |

- Public sign-up **always** creates a `patient` profile (`private.handle_new_user` ignores any role in the sign-up
  metadata). Staff roles are set only by a clinic admin (`admin_update_member`) or by the server.
- Deactivating a staff member removes all their data access immediately (every policy checks `is_active`).
- Patients link a clinic record with a **one-time access code** (8 characters, 14-day expiry, stored only as a
  SHA-256 hash) **plus their birth year**. Five failed attempts per hour lock further attempts.

## Where each rule is enforced

| Layer | Enforces |
|---|---|
| Postgres RLS + column grants (`supabase/migrations/20261126000000_auth_roles.sql`) | Clinic isolation, role permissions, read-only AI results, append-only audit log, hidden access-code hashes |
| Security-definer RPCs | The only write paths for referral follow-up, access codes, account linking, staff role changes, clinic stats |
| Next.js server (`lib/server/auth.ts`) | Verifies the session (`getClaims()`), role checks for pages/actions/routes, redirects |
| `proxy.ts` | Session refresh + optimistic redirect to sign-in (never relied on for authorisation) |

The **service-role key** is used server-side only, and only for steps RLS forbids to every user by design:
writing AI results and generated reports, the temporary upload bucket, and creating/resetting staff accounts.
Each of those code paths authorises the caller first.

## Data minimisation
- Retina photos: uploaded to a private bucket through a short-lived signed URL, deleted in a `finally` block right
  after inference. Images are never stored in the database.
- Patient record: name, clinic reference, birth year, optional sex, diabetes type/year, optional phone.
- The LLM receives only the model result plus age and years with diabetes: never names, references or contact details.
- Audit entries record who did what to which record id, and which fields changed, never the values.

## Audit log
Triggers record patient create/update/delete, access-code issue, account linking and screening creation; RPCs record
referral changes and staff changes; pages record when staff open a patient or screening (`log_record_access`). Browsers
cannot insert, update or delete audit rows, and `private.audit()` is not callable by them.

## Tests
`cd frontend && npm run test:db` runs the real migrations in embedded Postgres (PGlite) and checks, among others:
anonymous access to every table is denied, sign-up cannot escalate, clinic isolation for read/update/delete, admins
cannot read patient data, AI results cannot be written by browsers, the access-code flow and its brute-force limit,
audit completeness and immutability, and notifications isolation.

## Known limits
- **Email**: Supabase's built-in email sender is rate-limited and meant for testing. Patient email confirmation and
  password-reset emails need a custom SMTP provider in production. Staff onboarding does not depend on email
  (admins hand over temporary passwords, which must be changed at first sign-in).
- Rate limiting in the Next.js layer is per server instance (in memory). Supabase Auth applies its own limits.
- Encryption at rest is provided by the hosting provider (Supabase); there is no additional field-level encryption.
- No multi-factor authentication yet.
- **No regulatory compliance is claimed.** This is a hackathon build tested with synthetic records only; using it
  with real patient data would require a privacy/legal review, a data-processing agreement with the hosting
  providers, and a security assessment.
