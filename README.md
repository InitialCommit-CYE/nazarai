# NazarAI: AI diabetic retinopathy screening for Pakistan

> Pakistan has the world's highest diabetes rate and 15 eye doctors per million people. Millions are going blind
> from a disease that's preventable if caught early. NazarAI screens a retina photo in seconds, so specialists
> only see the patients who need them.

**Capital Youth Expo Hackathon 2026, Innovation Sprint, Track 2: Healthcare (04-HK).**

| | |
|---|---|
| Live app | https://nazarai-jade.vercel.app |
| Video walkthrough (≤ 2 min) | _to be added_ |
| Pitch deck | _to be added_ |

Screening / triage support only. **Not a medical diagnosis.**

## For judges: try it in about 60 seconds

**[Open the demo as the health worker](https://nazarai-jade.vercel.app/auth/demo?as=health-worker)**: one click, no sign-up, straight to the screening page.

1. Press **Try a sample case**. It picks a demo patient and a public retina photo, runs the screening, and opens the result: the decision in English and Urdu, the heatmap, and the dataset's own expert label so you can check the model yourself.
2. Go back to **Screen**, pick any patient and choose **Sample 3**: a blurry photo. The quality gate rejects it with retake advice instead of grading it.
3. On the result, press **Switch to specialist** in the guide (or open [the specialist view](https://nazarai-jade.vercel.app/auth/demo?as=eye-specialist)) to see the referral arrive in the worklist, urgent first.

Patients are synthetic and photos come from the public IDRiD dataset. The five sample patients cannot be edited or deleted, so the demo stays the same for the next person.

## The problem
| Fact | Source |
|---|---|
| Highest diabetes prevalence in the world: 31.4% of adults 20–79 (age-standardised) | IDF Diabetes Atlas, 11th ed. (2025) |
| 34.5 million adults with diabetes (2024), projected 70.2 million by 2050 | [IDF Diabetes Atlas](https://diabetesatlas.org/data-by-location/country/pakistan) |
| Only 15 ophthalmologists per million people | [Express Tribune, Aug 2026](https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan) |
| Diabetic patients in Pakistan are not routinely screened for DR; ~27% of diabetics worldwide have some DR | [PMC9940560](https://pmc.ncbi.nlm.nih.gov/articles/PMC9940560) |
| First FDA-authorised autonomous AI diagnostic (IDx-DR, 2018): 87% sensitivity, 90% specificity | [AAO](https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f), [Chief Healthcare Executive](https://chiefhealthcareexecutive.com/view/the-numbers-behind-the-first-fdaapproved-autonomous-ai-diagnostic-system) |

Our own rough estimate: 27% × 34.5M ≈ **9 million** Pakistanis may have some DR.

## What it does
1. **Quality gate**: blurry, dark, over-exposed or non-retina photos are rejected with Urdu/English retake advice, never graded.
2. **Grading**: EfficientNet-B3 ordinal regression → DR grade 0–4 on the International Clinical DR scale, with heuristic confidence.
3. **Referral**: grade 0–1 rescreen in 12 months · grade 2 refer · grade 3–4 refer urgently. Sensitivity-first threshold; borderline results are referred.
4. **Explainability**: Grad-CAM heatmap with overlay, opacity slider, side-by-side and zoom.
5. **Patient report**: plain Urdu (Nastaliq, RTL) or English from fixed bilingual templates, built from the stored result only; PDF referral slip.
6. **Referral worklist**: the clinic's screenings, urgent first, live updates; specialists and health workers book the
   appointment, record the outcome and add clinical notes. The AI result itself can never be edited.
7. **Patient records**: register, search, sort, edit and delete patients of your clinic; full screening history.
8. **Accounts and roles**: health worker, eye specialist, clinic admin and patient. Access is enforced in the database
   with Row Level Security: clinics are isolated, admins manage staff but cannot open patient records, every record
   access and change goes to an append-only audit log. See [docs/SECURITY.md](docs/SECURITY.md).
9. **Patient portal**: patients see their results, reports and appointments after linking their record with a
   one-time code from the clinic.
10. **Model performance**: real validation + external-test (IDRiD) metrics next to the IDx-DR benchmark.

## Training data: why APTOS 2019 + EyePACS
No public Pakistani DR grading dataset exists yet. **APTOS 2019** comes from Aravind Eye Hospital in India: a South Asian
population photographed on many different cameras with mixed image quality, the closest public match to Pakistani
diabetes clinics and Basic Health Units. Alone it is small (3,662 images) and our APTOS-only run missed 77 referable
cases on the external test, so it is combined with **EyePACS** (US screening photos, ~35k images) for volume.
**IDRiD**, also from India, is kept as a fully held-out external test set.

## Architecture
```
Browser ─► Vercel (Next.js pages + /api/* gateway) ─► Supabase (PostgreSQL · private Storage · Realtime)
                     │
                     └────► Hugging Face Space: FastAPI ML service
                            (quality gate · ONNX grading · Grad-CAM · PDF)
Browser ─► Supabase Storage via short-lived signed upload URL (image deleted right after inference)
```
Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) ·
[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/TEAM_RUNBOOK.md](docs/TEAM_RUNBOOK.md) · [docs/SECURITY.md](docs/SECURITY.md) · [DECISIONS.md](DECISIONS.md)

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, Recharts, on Vercel |
| Backend / data | Supabase Auth, Supabase PostgreSQL (Row Level Security, audit log), Supabase Storage (private bucket), Supabase Realtime |
| ML service | Python 3.12, FastAPI, ONNX Runtime, PyTorch + timm, OpenCV, pytorch-grad-cam, ReportLab, on Hugging Face Spaces (Docker) |
| Training | Kaggle GPU notebooks, PyTorch, timm, albumentations, scikit-learn |
| Patient reports | Fixed bilingual templates (Urdu / English); an optional LLM layer can reword the explanation paragraph only |

### Why this hosting (all free tiers)
| Need | Choice | Why not the alternatives |
|---|---|---|
| Web app + API gateway | **Vercel Hobby** | Built for Next.js; deploys from GitHub on every push. Netlify / Cloudflare Pages support Next.js 16 server routes less directly. |
| Database, image upload, live queue | **Supabase Free** | The only free service with Postgres + private file storage + realtime in one place. Neon has no storage or realtime; Firebase would need a rewrite to a document database. |
| ML inference | **Hugging Face Spaces (Docker, CPU Basic: 2 vCPU, 16 GB)** | Since mid-2026 a Docker Space needs HF PRO ($9/month); the CPU Basic hardware itself has no hourly cost. Cheapest option that fits ONNX + PyTorch Grad-CAM: Render's free tier (512 MB) is too small; Railway and Fly.io have no lasting free tier. Live: https://hassanali0987654-nazarai-ml.hf.space/health |

## Repository
```
ml/src/nazarai_ml/   shared preprocessing, quality gate, model, thresholds, decision rule, training, evaluation, ONNX export
ml/notebooks/        Kaggle training + evaluation notebooks
ml/reports/          metrics.json + plots of the deployed model (written by evaluate.py; never edited by hand)
ml/runs/             archived earlier training runs, kept as fallbacks (not deployed)
backend/             FastAPI service, tests, Dockerfile
frontend/            Next.js app (pages, components, app/api gateway routes)
supabase/            migrations (schema, RLS, storage bucket, realtime trigger)
demo_images/         6 IDRiD images (CC BY 4.0): grades 0–4 + one unsuitable photo
scripts/             HF Space deploy, model upload, pipeline-test model
docs/                architecture, API, database, deployment, team runbook
```

## Run locally
See [docs/DEPLOYMENT.md § Local development](docs/DEPLOYMENT.md#local-development). Short version:
```bash
cd backend && py -3.12 -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt && .venv/Scripts/python -m pytest -q
cd frontend && npm ci && npm run build
```
Without trained weights, `scripts/make_pipeline_test_model.py` creates an **untrained** artefact that exercises the
real pipeline; every result made with it is flagged "Development model: not a real prediction" and production refuses it.

## Training
`ml/notebooks/nazarai_train_kaggle.ipynb` (Kaggle GPU T4): grade-stratified split of APTOS 2019 + EyePACS (patient-level
for EyePACS; image-level for APTOS, which has no patient IDs) → EfficientNet-B3 (ImageNet) regression with SmoothL1, AdamW, cosine schedule, AMP,
flip/rotation augmentation → best checkpoint by validation QWK → QWK-optimised grade thresholds and a ≥ 90%-sensitivity
referral threshold on **validation only** → ONNX export with parity check → evaluation with 4-view TTA on validation
and the external IDRiD set.

## Model performance
Model `efficientnet_b3-384-202611251638`: EfficientNet-B3, 384 px, trained on 33,229 APTOS 2019 + EyePACS images (Kaggle T4).
All numbers are from `ml/reports/metrics.json`, measured with the served ONNX model (CPU, 4-view TTA) and the deployed
referral rule (grade ≥ 2 or score ≥ 0.3372, chosen on validation for ≥ 90% sensitivity).

| Referable DR (grade ≥ 2) | Validation (APTOS + EyePACS, n = 5,541) | External test (IDRiD, n = 516) | IDx-DR (reported) |
|---|---|---|---|
| Sensitivity | 90.1% | **99.4%** (321/323) | 87% |
| Specificity | 86.0% | **61.7%** (119/193) | 90% |
| PPV / NPV | 64.2% / 96.9% | 81.3% / 98.4% | not reported |
| AUC-ROC | 0.949 | **0.984** | not reported |
| QWK (5 grades) | 0.842 | **0.856** | n/a |

Mean CPU inference 0.45 s/image (p95 0.58 s, without Grad-CAM). Plots: `ml/reports/roc.png`, `ml/reports/confusion_matrix_*.png`.

**Reading these honestly:** on the external IDRiD set the model ranks images very well (AUC 0.984) and missed 2 of 323
referable cases, but specificity falls to 61.7%: the referral cut-off was fixed on validation data and deliberately not
re-tuned on the test set, and scores shift between cameras. Each new site therefore needs threshold calibration, the
first step of the planned pilot. IDx-DR's figures come from a different population and reference standard, so they are
a reference point, not a head-to-head comparison.

## Disclosures
**Datasets**
- APTOS 2019 Blindness Detection: Kaggle competition data (Aravind Eye Hospital, India), competition rules licence: https://www.kaggle.com/c/aptos2019-blindness-detection. **Training and validation data.**
- EyePACS / Kaggle Diabetic Retinopathy Detection (2015): **training and validation data**, used via the pre-resized community copy `tanlikesmath/diabetic-retinopathy-resized`; competition rules licence: https://www.kaggle.com/c/diabetic-retinopathy-detection
- IDRiD: Indian Diabetic Retinopathy Image Dataset, © Porwal, Pachade & Kokare, **CC BY 4.0**: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid (mirror: https://huggingface.co/datasets/amin-nejad/idrid-disease-grading). External test set and the 6 bundled demo images (resized to 1400 px; see `demo_images/manifest.json`).

**Pretrained weights**: timm `efficientnet_b3` ImageNet weights (Apache-2.0, via Hugging Face Hub).

**Libraries**: PyTorch, torchvision, timm, ONNX, ONNX Runtime, OpenCV, albumentations, scikit-learn, SciPy, NumPy,
pandas, matplotlib, pytorch-grad-cam, FastAPI, Uvicorn, Pydantic, ReportLab, arabic-reshaper, python-bidi,
huggingface_hub, pytest; Next.js, React, Tailwind CSS, shadcn/ui (Radix UI, `cn`, class-variance-authority),
lucide-react, Recharts, Zod, @supabase/supabase-js, @supabase/ssr, @anthropic-ai/sdk (optional report wording, not enabled in the
deployment). Testing: Playwright (visual checks), PGlite (embedded Postgres for the RLS test suite), Node test runner.

**Fonts**: Geist (SIL OFL), Noto Nastaliq Urdu (SIL OFL, web), Noto Naskh Arabic (SIL OFL, PDF; licence in `backend/app/fonts/OFL.txt`).

**APIs & hosting**: Vercel (frontend) · Supabase (auth, database, storage, realtime) · Hugging Face Spaces (ML service) and
Hub (model weights) · Kaggle (training GPUs).

**AI assistance**: code was written with Claude Code (Anthropic) as an AI coding assistant during the competition window.

## Intended use, limitations and safety
- For screening adults with diabetes by trained health workers; every referral should be confirmed by an eye specialist.
- Not validated on Pakistani clinical data or local cameras yet; no macular-oedema grading; heuristic quality gate;
  confidence is not calibrated; Grad-CAM is not proof of correctness.
- Scores shift between cameras, so each new site needs threshold calibration, which is the first step of the planned pilot.
- The demo clinic holds synthetic patients only; retinal images are deleted after inference and only results are stored.
- No regulatory compliance (e.g. data-protection law for health records) is claimed; real patient use would need a
  privacy/legal review first. Known security limits are listed in [docs/SECURITY.md](docs/SECURITY.md).

> This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment.
>
> یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔

## Team
Mohid Fida (hosting, frontend, README) · Hassan (ML lead, training) · ML-2 (data & evaluation) · ML-3 (backend) · F (deck & research). _Remaining full names to be added._
