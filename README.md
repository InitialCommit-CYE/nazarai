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
6. **Clinic queue**: every screening sorted by urgency, live updates via Supabase Realtime.
7. **Model performance**: real validation + external-test (IDRiD) metrics next to the IDx-DR benchmark.

## Why APTOS 2019
No public Pakistani DR grading dataset exists yet. APTOS 2019 comes from Aravind Eye Hospital in India: a South Asian
population photographed on many different cameras with mixed image quality, which is the closest public match to
Pakistani diabetes clinics and Basic Health Units. IDRiD, also from India, is kept as a fully held-out external test set.

## Architecture
```
Browser ─► Vercel (Next.js pages + /api/* gateway) ─► Supabase (PostgreSQL · private Storage · Realtime)
                     │
                     └────► Hugging Face Space: FastAPI ML service
                            (quality gate · ONNX grading · Grad-CAM · PDF)
Browser ─► Supabase Storage via short-lived signed upload URL (image deleted right after inference)
```
Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) ·
[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/TEAM_RUNBOOK.md](docs/TEAM_RUNBOOK.md) · [DECISIONS.md](DECISIONS.md)

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, Recharts, on Vercel |
| Backend / data | Supabase PostgreSQL (RLS), Supabase Storage (private bucket), Supabase Realtime |
| ML service | Python 3.12, FastAPI, ONNX Runtime, PyTorch + timm, OpenCV, pytorch-grad-cam, ReportLab, on Hugging Face Spaces (Docker) |
| Training | Kaggle GPU notebooks, PyTorch, timm, albumentations, scikit-learn |
| Patient reports | Fixed bilingual templates (Urdu / English); an optional LLM layer can reword the explanation paragraph only |

### Why this hosting (all free tiers)
| Need | Choice | Why not the alternatives |
|---|---|---|
| Web app + API gateway | **Vercel Hobby** | Built for Next.js; deploys from GitHub on every push. Netlify / Cloudflare Pages support Next.js 16 server routes less directly. |
| Database, image upload, live queue | **Supabase Free** | The only free service with Postgres + private file storage + realtime in one place. Neon has no storage or realtime; Firebase would need a rewrite to a document database. |
| ML inference | **Hugging Face Spaces (CPU, Docker)** | 16 GB RAM for free, enough for ONNX + PyTorch Grad-CAM. Render's free tier (512 MB) is too small; Railway and Fly.io have no lasting free tier. |

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
`ml/notebooks/nazarai_train_kaggle.ipynb` (Kaggle GPU T4): stratified split of APTOS 2019 by grade (image-level, since
APTOS has no patient IDs) → EfficientNet-B3 (ImageNet) regression with SmoothL1, AdamW, cosine schedule, AMP,
flip/rotation augmentation → best checkpoint by validation QWK → QWK-optimised grade thresholds and a ≥ 90%-sensitivity
referral threshold on **validation only** → ONNX export with parity check → evaluation with 4-view TTA on validation
and the external IDRiD set.

## Model performance
_The APTOS 2019 model is training now. Results will be added here from `ml/reports/metrics.json` once it is evaluated._

What will be reported, for referable DR (grade ≥ 2): sensitivity, specificity, PPV / NPV, AUC-ROC and 5-grade QWK, on
APTOS validation and on the external IDRiD test set (n = 516), next to the IDx-DR benchmark (87% sensitivity / 90%
specificity). The referral threshold is fixed on validation data and never re-tuned on the test set. IDx-DR's figures
come from a different population and reference standard, so they are a reference point, not a head-to-head comparison.

## Disclosures
**Datasets**
- APTOS 2019 Blindness Detection: Kaggle competition data (Aravind Eye Hospital, India), competition rules licence: https://www.kaggle.com/c/aptos2019-blindness-detection. **Training and validation data.**
- IDRiD: Indian Diabetic Retinopathy Image Dataset, © Porwal, Pachade & Kokare, **CC BY 4.0**: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid (mirror: https://huggingface.co/datasets/amin-nejad/idrid-disease-grading). External test set and the 6 bundled demo images (resized to 1400 px; see `demo_images/manifest.json`).

**Pretrained weights**: timm `efficientnet_b3` ImageNet weights (Apache-2.0, via Hugging Face Hub).

**Libraries**: PyTorch, torchvision, timm, ONNX, ONNX Runtime, OpenCV, albumentations, scikit-learn, SciPy, NumPy,
pandas, matplotlib, pytorch-grad-cam, FastAPI, Uvicorn, Pydantic, ReportLab, arabic-reshaper, python-bidi,
huggingface_hub, pytest; Next.js, React, Tailwind CSS, shadcn/ui (Radix UI, `cn`, class-variance-authority),
lucide-react, Recharts, Zod, @supabase/supabase-js, @anthropic-ai/sdk (optional report wording, not enabled in the
deployment).

**Fonts**: Geist (SIL OFL), Noto Nastaliq Urdu (SIL OFL, web), Noto Naskh Arabic (SIL OFL, PDF; licence in `backend/app/fonts/OFL.txt`).

**APIs & hosting**: Vercel (frontend) · Supabase (database, storage, realtime) · Hugging Face Spaces (ML service) and
Hub (model weights) · Kaggle (training GPUs).

**AI assistance**: code was written with Claude Code (Anthropic) as an AI coding assistant during the competition window.

## Intended use, limitations and safety
- For screening adults with diabetes by trained health workers; every referral should be confirmed by an eye specialist.
- Not validated on Pakistani clinical data or local cameras yet; no macular-oedema grading; heuristic quality gate;
  confidence is not calibrated; Grad-CAM is not proof of correctness.
- Scores shift between cameras, so each new site needs threshold calibration, which is the first step of the planned pilot.
- Synthetic patient references only; retinal images are deleted after inference and only metadata is stored.

> This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment.
>
> یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔

## Team
Mohid Fida (hosting, frontend, README) · Hassan (ML lead, training) · ML-2 (data & evaluation) · ML-3 (backend) · F (deck & research). _Remaining full names to be added._
