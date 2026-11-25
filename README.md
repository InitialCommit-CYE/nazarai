# NazarAI: AI diabetic retinopathy screening for Pakistan

> Pakistan has the world's highest diabetes rate and 15 eye doctors per million people. Millions are going blind
> from a disease that's preventable if caught early. NazarAI screens a retina photo in seconds, so specialists
> only see the patients who need them.

**Capital Youth Expo Hackathon 2026, Innovation Sprint, Track 2: Healthcare (04-HK).**

| | |
|---|---|
| Live app | _to be added after deployment_ |
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
5. **Patient report**: plain Urdu (Nastaliq, RTL) or English, written by Claude from the stored result only, with a fixed-template fallback; PDF referral slip.
6. **Clinic queue**: every screening sorted by urgency, live updates via Supabase Realtime.
7. **Model performance**: real validation + external-test (IDRiD) metrics next to the IDx-DR benchmark.

## Architecture
```
Browser ─► Vercel (Next.js pages + /api/* gateway) ─► Supabase (PostgreSQL · private Storage · Realtime)
                     │                         └────► Hugging Face Space: FastAPI ML service
                     │                                (quality gate · ONNX grading · Grad-CAM · PDF)
                     └────► Anthropic Claude API (explanation text only)
Browser ─► Supabase Storage via short-lived signed upload URL (image deleted right after inference)
```
Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) ·
[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/TEAM_RUNBOOK.md](docs/TEAM_RUNBOOK.md) · [DECISIONS.md](DECISIONS.md)

| Layer | Technology |
|---|---|
| UI generation | v0 by Vercel ([docs/V0_UI_PROMPT.md](docs/V0_UI_PROMPT.md)) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, Recharts, on Vercel |
| Backend / data | Supabase PostgreSQL (RLS), Supabase Storage (private bucket), Supabase Realtime |
| ML service | Python 3.12, FastAPI, ONNX Runtime, PyTorch + timm, OpenCV, pytorch-grad-cam, ReportLab, on Hugging Face Spaces (Docker) |
| Training | Kaggle GPU notebooks, PyTorch, timm, albumentations, scikit-learn |
| LLM | Anthropic Claude API (`claude-opus-5-5`) |

## Repository
```
ml/src/nazarai_ml/   shared preprocessing, quality gate, model, thresholds, decision rule, training, evaluation, ONNX export
ml/notebooks/        Kaggle training + evaluation notebook
ml/reports/          metrics.json + plots (written by evaluate.py; never edited by hand)
backend/             FastAPI service, tests, Dockerfile
frontend/            Next.js app (pages, components, app/api gateway routes)
supabase/            migrations (schema, RLS, storage bucket, realtime trigger)
demo_images/         6 IDRiD images (CC BY 4.0): grades 0–4 + one unsuitable photo
scripts/             HF Space deploy, model upload, pipeline-test model
docs/                architecture, API, database, deployment, v0 prompt
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
`ml/notebooks/nazarai_train_kaggle.ipynb` (Kaggle GPU): patient-level stratified split of EyePACS (+ APTOS when attached; the current model is EyePACS-only) →
EfficientNet-B3 (ImageNet) regression with SmoothL1, AdamW, cosine schedule, AMP, flip/rotation augmentation →
best checkpoint by validation QWK → QWK-optimised grade thresholds and a ≥ 90%-sensitivity referral threshold on
**validation only** → ONNX export with parity check → evaluation with 4-view TTA on validation and IDRiD.

## Model performance
Model `efficientnet_b3-384-202611250727`: EfficientNet-B3, 384 px, 10 epochs on 30,089 EyePACS images (Kaggle T4).
All numbers are from `ml/reports/metrics.json`, measured with the served ONNX model (CPU, 4-view TTA) and the deployed
referral rule (grade ≥ 2 or score ≥ 0.2104, chosen on validation for ≥ 90% sensitivity).

| Referable DR (grade ≥ 2) | Validation (EyePACS, n = 5,019) | External test (IDRiD, n = 516) | IDx-DR (reported) |
|---|---|---|---|
| Sensitivity | 89.7% | **100%** (323/323) | 87% |
| Specificity | 80.7% | **52.8%** (102/193) | 90% |
| PPV / NPV | 55.2% / 96.7% | 78.0% / 100% | not reported |
| AUC-ROC | 0.939 | **0.981** | not reported |
| QWK (5 grades) | 0.797 | **0.840** | n/a |

Mean CPU inference 0.53 s/image (p95 0.77 s, without Grad-CAM). Plots: `ml/reports/roc.png`, `ml/reports/confusion_matrix_*.png`.

**Reading these honestly:** on the external IDRiD set the model ranks images very well (AUC 0.981) and missed no referable
case, but specificity falls to 52.8%: scores run higher on IDRiD's cameras (most errors are one grade too high), and the
referral cut-off was fixed on EyePACS validation data and deliberately not re-tuned on the test set. Each new site or
camera therefore needs threshold calibration, which is the first step of the planned pilot. IDx-DR's figures come from a
different population and reference standard, so they are a reference point, not a head-to-head comparison.

## Disclosures
**Datasets**
- APTOS 2019 Blindness Detection: Kaggle competition data (Aravind Eye Hospital, India), competition rules licence: https://www.kaggle.com/c/aptos2019-blindness-detection. Supported by the training pipeline; **not used by the current model** (planned for the next run).
- EyePACS / Kaggle Diabetic Retinopathy Detection (2015): **training and validation data of the current model**, used via the pre-resized community copy `tanlikesmath/diabetic-retinopathy-resized`; competition rules licence: https://www.kaggle.com/c/diabetic-retinopathy-detection
- IDRiD: Indian Diabetic Retinopathy Image Dataset, © Porwal, Pachade & Kokare, **CC BY 4.0**: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid (mirror: https://huggingface.co/datasets/amin-nejad/idrid-disease-grading). External test set and the 6 bundled demo images (resized to 1400 px; see `demo_images/manifest.json`).

**Pretrained weights**: timm `efficientnet_b3` ImageNet weights (Apache-2.0, via Hugging Face Hub).

**Libraries**: PyTorch, torchvision, timm, ONNX, ONNX Runtime, OpenCV, albumentations, scikit-learn, SciPy, NumPy,
pandas, matplotlib, pytorch-grad-cam, FastAPI, Uvicorn, Pydantic, ReportLab, arabic-reshaper, python-bidi,
huggingface_hub, pytest; Next.js, React, Tailwind CSS, shadcn/ui (Radix UI, `cn`, class-variance-authority),
lucide-react, Recharts, Zod, @supabase/supabase-js, @anthropic-ai/sdk.

**Fonts**: Geist (SIL OFL), Noto Nastaliq Urdu (SIL OFL, web), Noto Naskh Arabic (SIL OFL, PDF; licence in `backend/app/fonts/OFL.txt`).

**APIs & hosting**: Anthropic Claude API (patient-report wording) · Vercel (frontend) · Supabase (database, storage,
realtime) · Hugging Face Spaces (ML service) and Hub (model weights) · Kaggle (training GPUs).

**AI assistance**: the UI design prompt targets v0 by Vercel; code was written with Claude Code (Anthropic) as an AI
coding assistant during the competition window.

## Intended use, limitations and safety
- For screening adults with diabetes by trained health workers; every referral should be confirmed by an eye specialist.
- Not validated on Pakistani clinical data or local cameras yet; no macular-oedema grading; heuristic quality gate;
  confidence is not calibrated; Grad-CAM is not proof of correctness.
- Synthetic patient references only; retinal images are deleted after inference; only metadata is stored.

> This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment.
>
> یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔

## Team
Hassan (ML lead) · ML-2 (data & evaluation) · ML-3 (backend) · ML-4 (frontend) · F (deck & research). _Full names to be added._
