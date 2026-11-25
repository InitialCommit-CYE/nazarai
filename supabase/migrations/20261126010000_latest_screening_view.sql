-- Latest screening per patient, for patient lists (one indexed lookup per page, no N+1).
-- security_invoker: the caller's RLS on public.screenings applies, so it leaks nothing.
create view public.patient_latest_screening with (security_invoker = true) as
select distinct on (patient_id) patient_id, id, urgency, quality_ok, referral_status, created_at
from public.screenings
where patient_id is not null
order by patient_id, created_at desc;

revoke all on public.patient_latest_screening from anon, authenticated;
grant select on public.patient_latest_screening to authenticated;
