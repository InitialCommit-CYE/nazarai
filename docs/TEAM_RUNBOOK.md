# Team runbook: where the model runs, and how we train, test and demo

Short version: **we train on Kaggle and run the app in the cloud. Nobody downloads datasets, and laptops only need a browser on the final day.**
`docs/DEPLOYMENT.md` has the full setup commands. This page covers who does what, in what order.

## 1. Where each part runs

| Stage | Where it runs | Who triggers it | What your laptop needs |
|---|---|---|---|
| **Training** | Kaggle notebook `nazarai-train` (GPU T4). APTOS is mounted there; IDRiD downloads inside Kaggle | Hassan (owns the Kaggle account and token) | Nothing. Optionally the `kaggle` CLI to push and check runs |
| **Model storage** | Hugging Face model repo `<hf-user>/nazarai-dr-model` (private) | Hassan uploads after each accepted run | Nothing |
| **Inference (the model answering)** | Hugging Face Space `<hf-user>/nazarai-ml`, FastAPI + ONNX on CPU. Downloads the weights from the model repo at startup | Hassan deploys the Space | Nothing |
| **Website + API gateway** | Vercel (root `frontend/`), redeploys automatically on every push to `main` | Mohid | Nothing |
| **Database + temporary image upload** | Supabase (Postgres + private bucket `retina-uploads`) | Mohid (one-time setup) | Nothing |
| **Patient report text** | Anthropic Claude API, called by the Vercel server routes | none (automatic) | Nothing |

```
Phone/laptop browser ─► Vercel (Next.js pages + /api/*) ─► HF Space (quality gate · grade · Grad-CAM · PDF)
                                       │                         ▲ downloads weights at startup
                                       ├─► Supabase (screenings, queue)       HF model repo ◄─ Kaggle training run
                                       └─► Claude API (explanation text only)
```

**Rule: the HF model repo is the only place the "current model" lives.** Kaggle produces it, the Space serves it, and
laptops pull it from there if needed. Never pass weights around on WhatsApp or USB.

## 2. Setup still to do (in this order)

1. **Supabase project** (Mohid): run the migration and copy the 3 keys (`docs/DEPLOYMENT.md` §1).
2. **APTOS training run finishes** (Hassan): check the numbers, then upload weights to the HF model repo (§2).
3. **HF Space** (Hassan): `scripts/deploy_hf_space.py`, then set `ML_SERVICE_API_KEY`, `HF_MODEL_REPO`, `HF_TOKEN` (§3).
   Done when `https://<hf-user>-nazarai-ml.hf.space/health` shows `"trained": true`.
4. **Vercel** (Mohid): import `InitialCommit-CYE/nazarai`, root `frontend`, add the env vars (§4).
5. **Smoke test** (anyone): `npm run smoke:e2e` against the live URL (§5). Then F tests it by hand like a real user.

## 3. Day-to-day: how each person tests

**Default: test against the live deployment.** Once steps 1–4 are done, most testing needs only the Vercel URL.

| You are working on | Do this | Model used |
|---|---|---|
| Testing the app as a user (F, everyone) | Open the Vercel URL. Use the "Try a sample image" buttons | Live model on the HF Space |
| Frontend (Mohid) | `cd frontend && npm ci && npm run dev`, with `.env.local` pointing `ML_SERVICE_URL` at the **live Space** | Live model. No Python needed |
| Backend / ML service (ML-3) | Run FastAPI locally (`docs/DEPLOYMENT.md` → Local development), with real weights in `ml/weights` (`hf download <hf-user>/nazarai-dr-model --local-dir ml/weights`) | Real model on your CPU |
| ML code (Hassan, ML-2) | Edit `ml/src/nazarai_ml`, run `backend/.venv/Scripts/python -m pytest -q`, then re-version the Kaggle dataset and push the notebook (`docs/DEPLOYMENT.md` §2) | Trains on Kaggle |

- **Git:** commit straight to `main`, no pull requests (hackathon speed). Every push redeploys the live site the
  judges see, so run `npm run build` in `frontend/` before pushing UI changes, and `git pull --rebase` first.
  The README is owned by Mohid; send README changes to him instead of editing it in parallel.
- **Secrets:** Mohid shares one `.env.local` by direct message (never in the repo or a group chat). Copy
  `.env.example` and fill it in. `ALLOW_UNTRAINED_MODEL` stays `false` everywhere except a local pipeline test.
- Local dev and the live site write to the **same** Supabase database, so test screenings show up in the live clinic
  queue. That is fine until the final-day reset (§5).

## 4. Changing the model

1. Change code or settings, then push the Kaggle notebook (Hassan).
2. When the run is `COMPLETE`: `kaggle kernels output hassanagddsbdxfg/nazarai-train -p ./kaggle_out`.
3. Check `metrics.json`. **Decide using validation numbers.** Report IDRiD honestly, but never pick a model or
   threshold because it scores better on IDRiD.
4. Upload with `scripts/upload_model.py`, copy `metrics.json` + PNGs into `ml/reports/`, commit.
5. Restart the HF Space (Settings → Restart) so it downloads the new weights. Check `/health` for the new `model_version`.

The website needs no change; it reads whatever model the Space serves.
**Feature freeze at submission (Nov 28, 11:59 PM PKT):** after that, no model swaps.

## 5. Final day (Dec 2): what runs where

Everything runs in the cloud. The presenting laptop only opens the Vercel URL in a browser. Arrive **15+ minutes early**
or we forfeit.

**Night before**
- Clear test rows so the queue looks clean: Supabase → SQL Editor → `delete from public.screenings;`
  (reports are deleted with them).
- Run the smoke test once against the live URL.
- Download the 2-minute video to the presenting laptop as an offline backup.

**30 minutes before the pitch**
- Open `https://<hf-user>-nazarai-ml.hf.space/health`. Free Spaces sleep after about 48 h without traffic, and waking
  one (container start + weight download) takes a few minutes.
- Open `https://<app>/api/health`: every check should be `ok: true`.
- Screen one sample image end to end, so the first live request on stage isn't a cold start.
- Have a phone hotspot ready in case the venue Wi-Fi fails.

**Live demo script (about 90 s):** urgent sample → grade card + heatmap → Urdu report → PDF; then the unsuitable
sample → rejected by the quality gate.

**If something breaks on stage:** switch to the video. Don't debug in front of the jury.
