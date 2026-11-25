# Database schema (Supabase PostgreSQL)

Migration: `supabase/migrations/20261125000000_init_screenings.sql`. Verified on PostgreSQL with stubbed Supabase
schemas: valid rows accepted, 7 classes of invalid rows rejected, anon `SELECT` denied, inserts succeed even when Realtime is unavailable.

## `public.screenings`
One row per screening attempt, **including quality-gate rejections**. No images and no real identifiers.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `created_at` | timestamptz | default `now()`; indexed desc |
| `demo_patient_code` | text | synthetic reference, `^[A-Za-z0-9_-]{1,40}$` |
| `age` | smallint | 0–120, optional (API accepts 18–120) |
| `diabetes_duration_years` | smallint | 0–100, optional |
| `image_source` | text | `upload` · `sample` · `camera` |
| `quality_ok` | boolean | quality gate result |
| `quality_issues` | jsonb array | `[{code, message}]`; codes: `blurry`, `too_dark`, `overexposed`, `not_retina`, `too_small`, `invalid_image` |
| `quality_metrics` | jsonb | blur score, brightness, green mean, circularity, etc. |
| `grade` | smallint | 0–4, NULL when rejected |
| `grade_label` | text | e.g. `Severe NPDR` |
| `continuous_score` | real | regression output (mean of 4 TTA views) |
| `confidence` | real | 0–1 heuristic, not calibrated |
| `referable` | boolean | deployed referral rule |
| `urgency` | text | `routine` · `refer` · `urgent` |
| `borderline` | boolean | referred as a safety precaution |
| `decision_reason` | text | human-readable rule that fired |
| `model_version` | text | e.g. `efficientnet_b3-384-202611261030` |
| `model_trained` | boolean | false = untrained pipeline-test artefact |
| `inference_time_ms` | real | total ML service time |
| `urgency_rank` | smallint, generated | urgent 0, refer 1, routine 2, rejected 3 |

Constraints
- `screenings_graded_iff_quality_ok`: graded fields all present ⇔ `quality_ok`.
- `screenings_urgent_for_grade_3_4`: grade ≥ 3 ⇒ urgency = urgent.
- `screenings_referable_for_grade_2`: grade ≥ 2 ⇒ referable.
- `screenings_referable_matches_urgency`: referable ⇔ urgency ≠ routine.

Indexes: `(created_at desc)`, partial `(urgency_rank, created_at desc) where quality_ok`.

Trigger: `screenings_notify_created` (AFTER INSERT) → `realtime.send({id, urgency}, 'screening_created', 'clinic-queue', false)`; errors are downgraded to warnings.

## `public.screening_reports`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `screening_id` | uuid FK → screenings, cascade | |
| `language` | text | `en` · `ur`; unique with `screening_id` (upsert on regenerate) |
| `body` | text | explanation paragraph only (1–6000 chars) |
| `generator` | text | `claude` · `template` |
| `llm_model` | text | model id when `claude` |
| `created_at` | timestamptz | |

## Security
- RLS enabled on both tables with **no policies** for `anon`/`authenticated`, plus `REVOKE ALL`. Only the service-role key (server routes) can read/write.
- Storage bucket `retina-uploads`: `public = false`, 10 MB limit, JPEG/PNG/WebP only, no `storage.objects` policies for browser roles. Uploads use signed upload URLs minted server-side.

## Seed data
`supabase/seed.sql` is intentionally empty: every screening row must come from a real model run. Populate a demo queue by screening the bundled images (or run `npm run smoke:e2e`).
