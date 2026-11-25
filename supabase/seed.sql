-- Intentionally empty.
--
-- NazarAI does not seed screening rows: every row in public.screenings must come from a real
-- run of the ML service on a public-dataset image. Seeding invented grades would be fabricated
-- results. To populate the clinic queue for a demo, run the bundled demo images through the app
-- (or `node frontend/scripts/smoke-e2e.mjs` against a running deployment).
select 1;
