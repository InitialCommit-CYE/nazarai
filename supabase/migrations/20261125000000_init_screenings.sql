-- NazarAI initial schema
-- * screenings: one row per screening attempt (including quality-gate rejections)
-- * screening_reports: patient-friendly explanation text (Claude or fixed template)
-- * private storage bucket for TEMPORARY retinal uploads (deleted right after inference)
-- * RLS on, with NO policies for anon/authenticated: the browser never reads tables directly.
--   All access goes through Next.js server routes using the service-role key.
-- * Realtime: a broadcast (no row data beyond id/urgency) tells open clinic queues to refetch.

-- gen_random_uuid() is built into PostgreSQL 13+; no extension needed.

-- ---------------------------------------------------------------------------
-- screenings
-- ---------------------------------------------------------------------------
create table public.screenings (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),

  -- Synthetic demo references only. Never real names or identifiers.
  demo_patient_code        text check (demo_patient_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  age                      smallint check (age between 0 and 120),
  diabetes_duration_years  smallint check (diabetes_duration_years between 0 and 100),
  image_source             text not null default 'upload' check (image_source in ('upload', 'sample', 'camera')),

  -- Quality gate
  quality_ok               boolean not null,
  quality_issues           jsonb not null default '[]'::jsonb check (jsonb_typeof(quality_issues) = 'array'),
  quality_metrics          jsonb not null default '{}'::jsonb,

  -- Model output (NULL when the quality gate rejected the image: rejected images are never graded)
  grade                    smallint check (grade between 0 and 4),
  grade_label              text,
  continuous_score         real,
  confidence               real check (confidence between 0 and 1),
  referable                boolean,
  urgency                  text check (urgency in ('routine', 'refer', 'urgent')),
  borderline               boolean,
  decision_reason          text,

  model_version            text not null check (char_length(model_version) between 1 and 80),
  model_trained            boolean not null,
  inference_time_ms        real check (inference_time_ms >= 0),

  urgency_rank             smallint generated always as (
                              case urgency when 'urgent' then 0 when 'refer' then 1 when 'routine' then 2 else 3 end
                            ) stored,

  -- Graded <=> quality passed
  constraint screenings_graded_iff_quality_ok check (
    (quality_ok and grade is not null and grade_label is not null and continuous_score is not null
       and confidence is not null and referable is not null and urgency is not null)
    or
    (not quality_ok and grade is null and urgency is null and referable is null)
  ),
  -- Referral safety invariants (mirror ml/src/nazarai_ml/decision.py)
  constraint screenings_urgent_for_grade_3_4 check (grade is null or grade < 3 or urgency = 'urgent'),
  constraint screenings_referable_for_grade_2 check (grade is null or grade < 2 or referable),
  constraint screenings_referable_matches_urgency check (urgency is null or referable = (urgency <> 'routine'))
);

comment on table public.screenings is 'NazarAI screening results. Demo data only: no real patient identifiers, no images.';
comment on column public.screenings.confidence is 'Heuristic confidence (grade-boundary margin x TTA agreement); not a calibrated probability.';
comment on column public.screenings.model_trained is 'false = untrained pipeline-test artefact; such rows must never be presented as real predictions.';

create index screenings_created_at_idx on public.screenings (created_at desc);
create index screenings_queue_idx on public.screenings (urgency_rank, created_at desc) where quality_ok;

-- ---------------------------------------------------------------------------
-- screening_reports
-- ---------------------------------------------------------------------------
create table public.screening_reports (
  id            uuid primary key default gen_random_uuid(),
  screening_id  uuid not null references public.screenings (id) on delete cascade,
  language      text not null check (language in ('en', 'ur')),
  body          text not null check (char_length(body) between 1 and 6000),
  generator     text not null check (generator in ('claude', 'template')),
  llm_model     text,
  created_at    timestamptz not null default now(),
  unique (screening_id, language)
);

create index screening_reports_screening_idx on public.screening_reports (screening_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-by-default for browser roles.
-- The service role (server-side only) bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.screenings enable row level security;
alter table public.screening_reports enable row level security;

revoke all on public.screenings from anon, authenticated;
revoke all on public.screening_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast a minimal "something changed" event on the public topic
-- 'clinic-queue'. Clients refetch /api/queue (server-side) when they receive it.
-- ---------------------------------------------------------------------------
create or replace function public.notify_screening_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('id', new.id, 'urgency', new.urgency),
      'screening_created',
      'clinic-queue',
      false
    );
  exception when others then
    -- Never fail a screening insert because Realtime is unavailable.
    raise warning 'nazarai realtime notify failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_screening_created() from public, anon, authenticated;

create trigger screenings_notify_created
after insert on public.screenings
for each row execute function public.notify_screening_created();

-- ---------------------------------------------------------------------------
-- Storage: private bucket for temporary uploads.
-- No storage.objects policies are created for anon/authenticated, so browsers can
-- neither list nor read objects. Uploads use short-lived signed upload URLs minted
-- server-side; the server downloads and deletes each object right after inference.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('retina-uploads', 'retina-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
