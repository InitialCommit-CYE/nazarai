-- NazarAI: accounts, roles, clinics, patients, referral workflow, notifications, audit log.
--
-- Security model (docs/SECURITY.md):
-- * Every table has RLS. anon has no access to anything. Browser sessions (role "authenticated")
--   can only touch rows their role and clinic allow; policies call private.* helpers.
-- * AI results are written only by the server (service role) after inference. Clinical users can
--   never insert or edit grades; referral follow-up goes through review_screening().
-- * Roles: operator + specialist = clinical staff of one clinic; admin = manages staff of one clinic
--   and sees aggregate stats + audit log, NOT patient identities or clinical details; patient = sees
--   only the patient records linked to their own account (linked with a one-time access code).
-- * Roles are never self-assigned: sign-up always creates a patient profile; staff roles are set by
--   a clinic admin (admin_update_member) or by the server with the service role.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
-- Functions are executable by PUBLIC by default; nothing in private should be, unless granted below.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Types and core tables
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'specialist', 'operator', 'patient');

create table public.clinics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  city        text check (char_length(city) <= 80),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text,
  full_name             text not null default '' check (char_length(full_name) <= 100),
  role                  public.app_role not null default 'patient',
  clinic_id             uuid references public.clinics (id) on delete restrict,
  is_active             boolean not null default true,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_staff_have_clinic check (role = 'patient' or clinic_id is not null),
  constraint profiles_patients_have_no_clinic check (role <> 'patient' or clinic_id is null)
);
create index profiles_clinic_idx on public.profiles (clinic_id, role);

create table public.patients (
  id                      uuid primary key default gen_random_uuid(),
  clinic_id               uuid not null references public.clinics (id) on delete restrict,
  mrn                     text not null check (mrn ~ '^[A-Za-z0-9_-]{1,40}$'),
  full_name               text not null check (char_length(trim(full_name)) between 2 and 100),
  birth_year              smallint not null check (birth_year between 1900 and 2100),
  sex                     text check (sex in ('female', 'male', 'other')),
  diabetes_type           text not null default 'type2' check (diabetes_type in ('type1', 'type2', 'gestational', 'other', 'unknown')),
  diabetes_since_year     smallint check (diabetes_since_year between 1900 and 2100),
  phone                   text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  user_id                 uuid references auth.users (id) on delete set null,
  access_code_hash        text,
  access_code_expires_at  timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (clinic_id, mrn),
  constraint patients_diabetes_after_birth check (diabetes_since_year is null or diabetes_since_year >= birth_year)
);
comment on table public.patients is 'Minimal patient identity for screening follow-up. Demo deployments hold synthetic records only.';
create index patients_clinic_created_idx on public.patients (clinic_id, created_at desc);
create index patients_clinic_name_idx on public.patients (clinic_id, lower(full_name));
create index patients_user_idx on public.patients (user_id) where user_id is not null;
create index patients_code_idx on public.patients (access_code_hash) where access_code_hash is not null;

-- Screenings gain ownership + a referral follow-up workflow. Legacy rows (clinic_id NULL) stay
-- readable only by the service role.
alter table public.screenings
  add column clinic_id       uuid references public.clinics (id) on delete restrict,
  add column patient_id      uuid references public.patients (id) on delete cascade,
  add column created_by      uuid references public.profiles (id) on delete set null,
  add column referral_status text not null default 'not_required'
    check (referral_status in ('not_required', 'pending', 'scheduled', 'seen', 'closed')),
  add column appointment_at  timestamptz,
  add column specialist_note text check (char_length(specialist_note) <= 2000),
  add column reviewed_by     uuid references public.profiles (id) on delete set null,
  add column reviewed_at     timestamptz;

create index screenings_clinic_queue_idx on public.screenings (clinic_id, urgency_rank, created_at desc);
create index screenings_clinic_referral_idx on public.screenings (clinic_id, referral_status, created_at desc);
create index screenings_patient_idx on public.screenings (patient_id, created_at desc);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('referral', 'appointment', 'result', 'account')),
  title       text not null check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 400),
  link        text check (link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Append-only. Details never contain patient identity or clinical values, only what changed.
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid references auth.users (id) on delete set null,
  clinic_id  uuid references public.clinics (id) on delete set null,
  action     text not null check (char_length(action) <= 60),
  entity     text not null check (entity in ('patient', 'screening', 'profile', 'clinic', 'report')),
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb
);
create index audit_log_clinic_idx on public.audit_log (clinic_id, at desc);

create table private.claim_attempts (
  user_id  uuid not null,
  at       timestamptz not null default now()
);
create index claim_attempts_idx on private.claim_attempts (user_id, at desc);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER: read profiles without recursing into profiles' own RLS)
-- ---------------------------------------------------------------------------
create or replace function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function private.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.clinic_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

-- Clinical staff of the given clinic (admins deliberately excluded from clinical data).
create or replace function private.is_clinical_in(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('operator', 'specialist') and p.clinic_id = target
  )
$$;

create or replace function private.is_admin_of(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin' and p.clinic_id = target
  )
$$;

create or replace function private.owns_patient(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patients pt
    join public.profiles p on p.id = auth.uid() and p.is_active and p.role = 'patient'
    where pt.id = target and pt.user_id = auth.uid()
  )
$$;

create or replace function private.audit(p_action text, p_entity text, p_entity_id uuid, p_clinic uuid, p_details jsonb default '{}'::jsonb, p_actor uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, clinic_id, action, entity, entity_id, details)
  values (coalesce(p_actor, auth.uid()), p_clinic, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

revoke all on all functions in schema private from public;
grant execute on function private.my_role(), private.my_clinic(), private.is_clinical_in(uuid),
  private.is_admin_of(uuid), private.owns_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: profile on sign-up, timestamps, referral defaults, audit, notifications
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Role is ALWAYS 'patient' here; user-supplied metadata can never grant a staff role.
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 100), 'patient')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger patients_touch before update on public.patients for each row execute function private.touch_updated_at();

-- Staff may only edit their own display name / password flag; everything else is server/RPC-only.
create or replace function private.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (
       new.role is distinct from old.role or new.clinic_id is distinct from old.clinic_id
       or new.is_active is distinct from old.is_active or new.email is distinct from old.email) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.guard_profile_update();

create or replace function private.screening_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.referral_status := case when new.referable then 'pending' else 'not_required' end;
  return new;
end $$;
create trigger screenings_defaults before insert on public.screenings for each row execute function private.screening_defaults();

create or replace function private.audit_patients() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.audit('patient.create', 'patient', new.id, new.clinic_id);
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(key), '[]'::jsonb) into changed
    from jsonb_each(to_jsonb(new)) n
    where key not in ('updated_at', 'access_code_hash') and n.value is distinct from (to_jsonb(old) -> key);
    if new.access_code_hash is not null and new.access_code_hash is distinct from old.access_code_hash then
      perform private.audit('patient.access_code_issued', 'patient', new.id, new.clinic_id);
    end if;
    if jsonb_array_length(changed) > 0 then
      perform private.audit(case when new.user_id is distinct from old.user_id then 'patient.account_linked' else 'patient.update' end,
                            'patient', new.id, new.clinic_id, jsonb_build_object('fields', changed));
    end if;
  else
    perform private.audit('patient.delete', 'patient', old.id, old.clinic_id);
  end if;
  return coalesce(new, old);
end $$;
create trigger patients_audit after insert or update or delete on public.patients
for each row execute function private.audit_patients();

create or replace function private.after_screening_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  perform private.audit('screening.create', 'screening', new.id, new.clinic_id,
                        jsonb_build_object('quality_ok', new.quality_ok), new.created_by);
  if new.clinic_id is not null and new.urgency in ('urgent', 'refer') then
    for s in select p.id from public.profiles p
             where p.clinic_id = new.clinic_id and p.role = 'specialist' and p.is_active loop
      perform private.notify(s.id, 'referral',
        case when new.urgency = 'urgent' then 'Urgent referral' else 'New referral' end,
        'A screening needs specialist follow-up.', '/screenings/' || new.id);
    end loop;
  end if;
  if new.patient_id is not null and new.quality_ok then
    perform private.notify(pt.user_id, 'result', 'New screening result', 'Your retinal screening result is ready.', '/my')
    from public.patients pt where pt.id = new.patient_id and pt.user_id is not null;
  end if;
  return new;
end $$;
create trigger screenings_after_insert after insert on public.screenings
for each row execute function private.after_screening_insert();

-- The old public broadcast (any visitor could subscribe) is replaced by RLS-filtered
-- postgres_changes on screenings/notifications for signed-in users.
drop trigger if exists screenings_notify_created on public.screenings;
drop function if exists public.notify_screening_created();

-- ---------------------------------------------------------------------------
-- RLS + grants. anon: nothing. authenticated: only what the policies allow.
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table private.claim_attempts enable row level security;

revoke all on public.clinics, public.profiles, public.patients, public.notifications, public.audit_log from anon, authenticated;
revoke all on public.screenings, public.screening_reports from anon, authenticated;
revoke all on private.claim_attempts from public, anon, authenticated;

-- clinics: members see their clinic; patients see clinics holding their records.
grant select on public.clinics to authenticated;
create policy clinics_select on public.clinics for select to authenticated using (
  id = private.my_clinic()
  or exists (select 1 from public.patients pt where pt.clinic_id = clinics.id and pt.user_id = auth.uid())
);

-- profiles
grant select (id, email, full_name, role, clinic_id, is_active, must_change_password, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name, must_change_password) on public.profiles to authenticated;
create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_colleagues on public.profiles for select to authenticated using (
  clinic_id is not null and clinic_id = private.my_clinic()
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- patients: clinical staff of the clinic (full CRUD), the linked patient (read only).
grant select (id, clinic_id, mrn, full_name, birth_year, sex, diabetes_type, diabetes_since_year, phone, user_id,
              access_code_expires_at, created_by, created_at, updated_at) on public.patients to authenticated;
grant insert (clinic_id, mrn, full_name, birth_year, sex, diabetes_type, diabetes_since_year, phone, created_by) on public.patients to authenticated;
grant update (mrn, full_name, birth_year, sex, diabetes_type, diabetes_since_year, phone) on public.patients to authenticated;
grant delete on public.patients to authenticated;
create policy patients_staff_select on public.patients for select to authenticated using (private.is_clinical_in(clinic_id));
create policy patients_self_select on public.patients for select to authenticated using (user_id = auth.uid() and private.my_role() = 'patient');
create policy patients_staff_insert on public.patients for insert to authenticated
  with check (private.is_clinical_in(clinic_id) and created_by = auth.uid());
create policy patients_staff_update on public.patients for update to authenticated
  using (private.is_clinical_in(clinic_id)) with check (private.is_clinical_in(clinic_id));
create policy patients_staff_delete on public.patients for delete to authenticated using (private.is_clinical_in(clinic_id));

-- screenings + reports: read-only for browsers; writes are server (service role) or RPC only.
grant select on public.screenings to authenticated;
create policy screenings_staff_select on public.screenings for select to authenticated using (private.is_clinical_in(clinic_id));
create policy screenings_patient_select on public.screenings for select to authenticated using (private.owns_patient(patient_id));

grant select on public.screening_reports to authenticated;
create policy reports_select on public.screening_reports for select to authenticated using (
  exists (select 1 from public.screenings s where s.id = screening_reports.screening_id)
);

-- notifications: own only; may only mark as read.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit log: clinic admins read their clinic's log. Nobody can modify it.
grant select on public.audit_log to authenticated;
create policy audit_admin_select on public.audit_log for select to authenticated using (private.is_admin_of(clinic_id));

-- ---------------------------------------------------------------------------
-- RPCs (the only write paths for sensitive workflow steps)
-- ---------------------------------------------------------------------------

-- Specialist/operator follow-up on a referral. Never touches the AI result.
create or replace function public.review_screening(p_id uuid, p_status text, p_appointment_at timestamptz default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.screenings%rowtype; r public.app_role; pt_user uuid;
begin
  select * into s from public.screenings where id = p_id;
  if not found or not private.is_clinical_in(s.clinic_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  r := private.my_role();
  if p_status not in ('pending', 'scheduled', 'seen', 'closed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if s.referral_status = 'not_required' then
    raise exception 'this screening does not need a referral' using errcode = '22023';
  end if;
  if p_status = 'scheduled' and p_appointment_at is null then
    raise exception 'an appointment time is required' using errcode = '22023';
  end if;
  if p_note is not null and r <> 'specialist' then
    raise exception 'only specialists can add clinical notes' using errcode = '42501';
  end if;
  update public.screenings set
    referral_status = p_status,
    appointment_at  = case when p_status = 'scheduled' then p_appointment_at else appointment_at end,
    specialist_note = coalesce(nullif(trim(p_note), ''), specialist_note),
    reviewed_by     = auth.uid(),
    reviewed_at     = now()
  where id = p_id;
  perform private.audit('screening.referral_' || p_status, 'screening', p_id, s.clinic_id,
                        jsonb_build_object('note_changed', p_note is not null));
  if p_status = 'scheduled' then
    select pt.user_id into pt_user from public.patients pt where pt.id = s.patient_id;
    if pt_user is not null then
      perform private.notify(pt_user, 'appointment', 'Eye specialist appointment booked',
        'Open NazarAI to see the date and time.', '/my');
    end if;
  end if;
end $$;

-- One-time code (printed on the referral slip) that lets a patient link their account.
create or replace function public.issue_patient_access_code(p_patient uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c uuid; code text := ''; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  select clinic_id into c from public.patients where id = p_patient;
  if c is null or not private.is_clinical_in(c) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  for i in 1..8 loop
    code := code || substr(alphabet, (get_byte(uuid_send(gen_random_uuid()), 0) % 32) + 1, 1);
  end loop;
  update public.patients
    set access_code_hash = encode(sha256(convert_to(code, 'UTF8')), 'hex'),
        access_code_expires_at = now() + interval '14 days'
  where id = p_patient;
  return code;
end $$;

-- Patient links a record: code + birth year must match. 5 failed attempts per hour per account.
create or replace function public.claim_patient_record(p_code text, p_birth_year int)
returns text language plpgsql security definer set search_path = '' as $$
declare pid uuid; c uuid; failures int;
begin
  if auth.uid() is null or private.my_role() is distinct from 'patient' then
    return 'not_patient';
  end if;
  select count(*) into failures from private.claim_attempts
    where user_id = auth.uid() and at > now() - interval '1 hour';
  if failures >= 5 then return 'too_many_attempts'; end if;
  select id, clinic_id into pid, c from public.patients
    where access_code_hash = encode(sha256(convert_to(upper(trim(p_code)), 'UTF8')), 'hex')
      and access_code_expires_at > now() and birth_year = p_birth_year and user_id is null
    limit 1;
  if pid is null then
    insert into private.claim_attempts (user_id) values (auth.uid());
    return 'invalid';
  end if;
  update public.patients set user_id = auth.uid(), access_code_hash = null, access_code_expires_at = null where id = pid;
  return 'linked';
end $$;

-- Clinic admin manages staff of their own clinic. Cannot change their own role or deactivate
-- themselves (prevents locking the clinic out) and cannot touch patients or other clinics.
create or replace function public.admin_update_member(p_user uuid, p_role public.app_role, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target public.profiles%rowtype;
begin
  select * into target from public.profiles where id = p_user;
  if not found or target.role = 'patient' or not private.is_admin_of(target.clinic_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_user = me then
    raise exception 'you cannot change your own role or status' using errcode = '42501';
  end if;
  if p_role = 'patient' then
    raise exception 'staff cannot be turned into patient accounts' using errcode = '22023';
  end if;
  update public.profiles set role = p_role, is_active = p_active where id = p_user;
  perform private.audit('profile.update', 'profile', p_user, target.clinic_id,
    jsonb_build_object('role', p_role, 'active', p_active, 'previous_role', target.role, 'previous_active', target.is_active));
end $$;

-- Aggregate numbers for a clinic dashboard (no identities). Staff and admins of the clinic.
create or replace function public.clinic_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c uuid := private.my_clinic(); since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if c is null or private.my_role() not in ('admin', 'operator', 'specialist') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'screenings', (select count(*) from public.screenings where clinic_id = c and created_at >= since),
    'rejected',   (select count(*) from public.screenings where clinic_id = c and created_at >= since and not quality_ok),
    'urgent',     (select count(*) from public.screenings where clinic_id = c and created_at >= since and urgency = 'urgent'),
    'refer',      (select count(*) from public.screenings where clinic_id = c and created_at >= since and urgency = 'refer'),
    'routine',    (select count(*) from public.screenings where clinic_id = c and created_at >= since and urgency = 'routine'),
    'open_referrals', (select count(*) from public.screenings where clinic_id = c and referral_status in ('pending', 'scheduled')),
    'patients',   (select count(*) from public.patients where clinic_id = c),
    'staff',      (select count(*) from public.profiles where clinic_id = c and is_active),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'total', t, 'referable', r) order by d)
      from (
        select (created_at at time zone 'Asia/Karachi')::date as d, count(*) as t, count(*) filter (where referable) as r
        from public.screenings where clinic_id = c and created_at >= since group by 1
      ) x), '[]'::jsonb)
  );
end $$;

-- Record that a staff member opened a patient's record (read access is audited too).
create or replace function public.log_record_access(p_entity text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if p_entity = 'patient' then
    select clinic_id into c from public.patients where id = p_id;
  elsif p_entity = 'screening' then
    select clinic_id into c from public.screenings where id = p_id;
  else
    raise exception 'invalid entity' using errcode = '22023';
  end if;
  if c is null or not private.is_clinical_in(c) then return; end if;
  perform private.audit(p_entity || '.view', p_entity, p_id, c);
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

revoke all on function public.review_screening(uuid, text, timestamptz, text), public.issue_patient_access_code(uuid),
  public.claim_patient_record(text, int), public.admin_update_member(uuid, public.app_role, boolean),
  public.clinic_stats(int), public.log_record_access(text, uuid), public.mark_notifications_read(uuid[])
  from public, anon;
grant execute on function public.review_screening(uuid, text, timestamptz, text), public.issue_patient_access_code(uuid),
  public.claim_patient_record(text, int), public.admin_update_member(uuid, public.app_role, boolean),
  public.clinic_stats(int), public.log_record_access(text, uuid), public.mark_notifications_read(uuid[])
  to authenticated;

-- Belt and braces: only the RLS helper functions in private are executable by browser sessions.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role(), private.my_clinic(), private.is_clinical_in(uuid),
  private.is_admin_of(uuid), private.owns_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: RLS-filtered change events for signed-in users.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.screenings, public.notifications;
  end if;
end $$;
