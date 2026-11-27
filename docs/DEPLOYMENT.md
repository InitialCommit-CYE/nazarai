# Deployment guide

Order: **Supabase → model weights → Hugging Face Space → Vercel → smoke test.** About 30 minutes once weights exist.

## 1. Supabase
Live project: ref `iwrvmubftokmkixknuth`, region Asia-Pacific (Singapore, `ap-southeast-1`), free plan.
1. Create a project (Asia-Pacific). Data access: tick **Enable Data API**, **Grant API access to new tables
   automatically** and **Enable RLS on new tables automatically**. The migrations revoke anon/authenticated access
   explicitly and re-grant only what RLS allows.
2. Project Settings → Integrations → **GitHub**: repo `InitialCommit-CYE/nazarai`, working directory `.`,
   **Deploy to production ON**, branch `main`. Every push to `main` applies new files in `supabase/migrations/`
   in filename order (schema, RLS, roles, audit log, views). **Never paste migrations into the SQL Editor**:
   untracked manual runs make the next deploy fail. New schema change = new timestamped file; never edit a deployed one.
3. Do **not** use the Vercel Marketplace "Supabase" install: it creates a second, Vercel-billed database. Set the
   keys by hand instead (§4).
4. Authentication → URL Configuration: **Site URL** `https://nazarai-jade.vercel.app`; Redirect URLs
   `https://nazarai-jade.vercel.app/**` (covers `/auth/confirm`) and `http://localhost:3000/**`.
   Providers → Email: keep "Confirm email" on. For real use, set a custom SMTP sender (the built-in one is
   rate-limited and for testing only). Staff accounts do not need email.
5. Demo clinic (synthetic data): put `DEMO_PASSWORD=...` and a different `DEMO_ADMIN_PASSWORD=...` in `frontend/.env.local`, then `cd frontend && npm run seed:demo`,
   then put the printed `DEMO_ACCOUNTS` line in Vercel's environment variables (sign-in page demo buttons).
6. Check: Table Editor shows `clinics`, `profiles`, `patients`, `screenings`, `screening_reports`, `notifications`,
   `audit_log`, all with RLS **enabled**; Storage shows the private bucket `retina-uploads`; Realtime is enabled.
7. Project Settings → API Keys: copy the project URL, the **publishable** key (`sb_publishable_…`) and a
   **secret** key (`sb_secret_…`, server-only) into `frontend/.env.local` and Vercel.

## 2. Model weights (after the Kaggle run)
0. Kaggle setup (once): verify your phone number (needed for GPU + internet). APTOS is optional: to include it,
   accept the `aptos2019-blindness-detection` rules **on the account whose API token is used** and add it to
   `competition_sources` in `ml/notebooks/kernel-metadata.json`; the notebook picks it up automatically. The package is published as the private dataset
   `hassanagddsbdxfg/nazarai-ml-src`; after changing `ml/src/nazarai_ml`, refresh it and re-run the notebook:
   ```bash
   mkdir -p /tmp/kg && cp ml/src/nazarai_ml/*.py ml/kaggle_dataset/dataset-metadata.json /tmp/kg/
   kaggle datasets version -p /tmp/kg -m "update nazarai_ml"
   kaggle kernels push -p ml/notebooks --accelerator NvidiaTeslaT4      # uses ml/notebooks/kernel-metadata.json
   kaggle kernels status hassanagddsbdxfg/nazarai-train
   kaggle kernels output hassanagddsbdxfg/nazarai-train -p ./kaggle_out  # when complete
   ```
1. Run `ml/notebooks/nazarai_train_kaggle.ipynb` on Kaggle (GPU T4, internet on). Download `/kaggle/working/release`.
2. Commit `release/reports/metrics.json` and the PNGs into `ml/reports/` (unchanged).
3. Upload weights: `backend/.venv/Scripts/python scripts/upload_model.py --run release --repo <hf-user>/nazarai-dr-model`
   (or use the notebook's last cell). The repo is private by default.

## 3. ML service on Hugging Face Spaces
Live: Space `HASSANALI0987654/nazarai-ml` (Docker, **CPU Basic**, public) → https://hassanali0987654-nazarai-ml.hf.space,
weights in the private model repo `HASSANALI0987654/nazarai-dr-model`. Since mid-2026 creating a Docker Space needs
**HF PRO** ($9/month, paid on the owner account); without it the API returns 402. Keep the hardware on CPU Basic
(upgrades are billed hourly). Cancel PRO after the Dec 2 finale. The Space sleeps after 48 h without traffic: open
`/health` a few minutes before any demo.

**Control from your machine** (Mohid): a fine-grained token scoped to the Space and the model repo (read + write, no
account-wide permissions) lives in `../HF_TOKEN.txt`, outside the repo. Personal-account repos cannot have
collaborators, so this token is how access is shared.
```bash
set -a; . ../HF_TOKEN.txt; set +a
python scripts/space_ctl.py status                 # stage, hardware, live /health
python scripts/space_ctl.py restart                # reload weights
python scripts/space_ctl.py set-var APP_ENV production
python scripts/space_ctl.py set-secret ML_SERVICE_API_KEY   # prompts for the value
python scripts/space_ctl.py upload-weights ./kaggle_out/release   # new model -> repo, then restart
```

First-time setup:
1. `huggingface-cli login` (write token), then
   `backend/.venv/Scripts/python scripts/deploy_hf_space.py --space <hf-user>/nazarai-ml`
2. Space → Settings → Variables and secrets:
   - secret `ML_SERVICE_API_KEY` = long random string (`python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   - variable `HF_MODEL_REPO` = `<hf-user>/nazarai-dr-model`
   - secret `HF_TOKEN` = read token (needed because the model repo is private)
3. Wait for the build, then `curl https://<hf-user>-nazarai-ml.hf.space/health` → `model_loaded: true`, `trained: true`.
   Free CPU Spaces sleep after inactivity; open `/health` a few minutes before a demo.

Local alternative: `docker build -f backend/Dockerfile -t nazarai-ml . && docker run -p 7860:7860 --env-file backend/.env nazarai-ml`.

## 4. Frontend on Vercel
Live project: `nazarai` (Mohid's Vercel account) → https://nazarai-jade.vercel.app
1. The Vercel GitHub app is installed on the `InitialCommit-CYE` org and the repo is connected: every push to
   `main` deploys production automatically. Manual deploy from the repo root: `vercel deploy --prod`.
2. **Root Directory: `frontend`**. Framework preset: Next.js. **Function region: `sin1` (Singapore)**, set in
   Project Settings → Functions so it sits next to the Supabase database (`frontend/vercel.json` mirrors it).
3. Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_APP_URL=https://nazarai-jade.vercel.app`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`,
   `ML_SERVICE_URL=https://<hf-user>-nazarai-ml.hf.space`, `ML_SERVICE_API_KEY` (same value as the Space secret),
   `DEMO_ACCOUNTS` (sign-in page demo buttons). Optional: `ANTHROPIC_API_KEY`. Do **not** set
   `ALLOW_UNTRAINED_MODEL` in production. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
4. Function duration: `/api/screen` declares `maxDuration = 120` (Fluid Compute). Cold ML starts can still be slow
   on the first request; warm the Space first.

## 5. Verify
- `https://<app>/api/health` → every check `ok: true`.
- `cd frontend && BASE_URL=https://<app> npm run smoke:e2e` (reads `.env.local`; needs `npm run seed:demo` first).
  Signs in as the demo health worker and screens all six demo images: signed upload, temporary upload deleted,
  rejection of the unsuitable one, both reports, the Urdu PDF and the result page. Then the demo eye specialist must see
  every screening in today's queue, sorted by urgency. It deletes its own rows at the end (`KEEP=1` keeps them).
- Supabase Storage `retina-uploads/incoming` should be empty after the run (uploads are deleted).
- Open `/queue` in a second tab while screening: the new row appears without refresh.

## Local development
```bash
# ML service (Python 3.12)
cd backend && py -3.12 -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
../backend/.venv/Scripts/python ../scripts/make_pipeline_test_model.py --out ../ml/weights-dev   # untrained, pipeline only
MODEL_DIR=../ml/weights-dev ML_SERVICE_API_KEY=dev .venv/Scripts/python -m uvicorn app.main:app --port 8000
.venv/Scripts/python -m pytest -q

# Frontend (Node 20.9+)
cd frontend && npm ci && cp ../.env.example .env.local   # fill Supabase keys; ML_SERVICE_URL=http://127.0.0.1:8000
# ALLOW_UNTRAINED_MODEL=true only while using the pipeline-test model
npm run dev
```
