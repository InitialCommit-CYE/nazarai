# Project Brief: NazarAI: AI Diabetic Retinopathy Screening for Pakistan

> **For Claude Code:** This file is the single source of truth for this project. Read all of it before writing code. Follow the scope, stack, structure and safety rules below. When a choice isn't specified, pick the simplest option that works within 24 hours and note it in `DECISIONS.md`.
>
> (The name "NazarAI" is a placeholder. The team may rename it. *Nazar* means sight or vision in Urdu.)

---

## Current state (updated 2026-11-26). Read this first in a new chat

**Owner:** Mohid Fida (GitHub `M0hid-ai`, org owner of InitialCommit-CYE) owns hosting, frontend/UI and the README. Hassan (ML lead) trains models.

**Git workflow (owner's rule):** commit straight to `main`, no PRs; many small, real commits; **never add a `Co-Authored-By: Claude` trailer**; `git pull --rebase` before every push; run `npm run build` in `frontend/` before pushing UI changes (`main` auto-deploys to the live site).

### Live system (all working end to end, verified 2026-11-26)
| Part | Where | Notes |
|---|---|---|
| Website + API gateway | Vercel project `nazarai` (Mohid's account) → **https://nazarai-jade.vercel.app** | Root dir `frontend`, functions in `sin1` (Singapore, set on the project), GitHub auto-deploy from `main`. Manual: `vercel deploy --prod` from the **repo root** (that is where `.vercel` is linked) |
| Database, auth, uploads | Supabase project `iwrvmubftokmkixknuth`, Asia-Pacific (Singapore), free plan | Supabase **GitHub integration applies `supabase/migrations/*` on every push to `main`**. Never paste migrations into the SQL Editor; add a new timestamped file instead |
| ML service | HF Space `HASSANALI0987654/nazarai-ml` → https://hassanali0987654-nazarai-ml.hf.space | Docker, **CPU Basic**, public; needs **HF PRO** ($9/mo, paid, on Hassan's account; cancel after Dec 2). Every endpoint except `/health` needs `X-API-Key`. Sleeps after 48 h idle: hit `/health` before demos |
| Model weights | Private HF repo `HASSANALI0987654/nazarai-dr-model` (model.onnx, model.pt, model_config.json) | Deployed model `efficientnet_b3-384-202611251638`, trained on **APTOS 2019 + EyePACS** (both disclosed); IDRiD external test: sens 99.4%, spec 61.7%, AUC 0.984 |

**Control the Space from this machine:** `set -a; . ../HF_TOKEN.txt; set +a` then `python scripts/space_ctl.py status|restart|set-var|set-secret|upload-weights` (token is fine-grained, scoped read+write to the Space and model repo only). Mohid also has Hassan's HF (and can get Kaggle) logins if ever needed.

### Secrets: where they live (never commit, never print)
- `frontend/.env.local` (git-ignored): Supabase URL / publishable / secret keys, `ML_SERVICE_URL`, `ML_SERVICE_API_KEY`, `DEMO_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_ACCOUNTS`. Same values are set on Vercel (Production).
- `ML_SERVICE_API_KEY.txt` and `HF_TOKEN.txt`: in the parent folder `Desktop/Nazar-ai/`, outside the repo.

### Accounts and demo
- Seeded demo clinic (`cd frontend && npm run seed:demo`): health worker, eye specialist, clinic admin, patient + 5 synthetic patients. Sign-in page shows **2 one-click buttons** (health worker, eye specialist). Landing CTAs use `/auth/demo?as=health-worker|eye-specialist` (server-side sign-in, lands on `/screen` or `/queue`); `/auth/sign-in?demo=…` still signs in from the browser and lands on the dashboard. The five seeded patients are read-only for demo accounts.
- Admin `clinic.admin@demo.nazarai.app` uses the private `DEMO_ADMIN_PASSWORD` (the shared demo password is public via the buttons, so it must never open the admin).
- Six real screenings of DEMO-1005 exist from the live test (2 urgent / 1 refer / 2 routine / 1 rejected). Clear before the finale if wanted: `delete from public.screenings;`.

### Design system (keep it; the owner rejected the generic "Claude look")
- Font: **Archivo** (heavy, `wdth` 112 via `.font-display`) for headlines and UI; Plex Mono only for record numbers. **No serif headlines, no tracked mono-caps eyebrows.** `.eyebrow` = bold sentence case led by a short rule.
- Colours (tokens in `app/globals.css`): `abyss` near-black, `ink` petrol, `paper`/`background` warm off-white, `signal` cyan (accent, one bright band), referral `routine`/`refer`/`urgent`. Dark navbar on every page. Laptop-first.
- Logo: variation 4 "lens" mark (Urdu ن with an iris dot) as SVG in `components/site/logo.tsx` and `app/icon.svg`; keep both in sync.
- Landing (`app/page.tsx`): hero → problem (giant cyan stats) → Today vs With NazarAI → how it works + 5 real retina grades → evidence → where it works → cyan CTA.

### Content rules
- Only sourced or measured claims. Model numbers come from `ml/reports/metrics.json` (also bundled at `frontend/lib/server/data/metrics.json` by `scripts/sync-metrics.mjs` on prebuild, so `/performance` works without the ML service). The 9M figure is labelled an estimate. IDx-DR is a reference point, not head-to-head.
- Reports use fixed Urdu/English templates (no LLM key set). A Gemini key may come later; that needs a provider swap in `frontend/lib/server/report.ts`.

### Open items
- README Team section: real names still missing. Feature freeze **Nov 28, 2026, 11:59 PM PKT**; finale **Dec 2** (arrive 15 min early).
- Deeper result screens (result / explain / report) inherited the new tokens but never got a dedicated UI pass.
- Patient self sign-up needs email confirmation; Supabase's built-in mailer is heavily rate-limited (consider turning "Confirm email" off for the demo).
- Pre-event deck: artifact https://claude.ai/artifact/9yq3mZvhZMHJUyCGDMzLtD and `NazarAI-PreEvent.pptx` in the parent folder (Arial fonts; team names are placeholders).
- `ONBOARDING.md` is an uncommitted draft.

### Windows gotchas on this machine
- Git Bash rewrites leading-slash args: prefix `MSYS_NO_PATHCONV=1` (e.g. `vercel api /v9/...`, URLs in scripts).
- Files are CRLF; exact-match edits must normalise line endings.
- Playwright: use `channel: "msedge"` (bundled Chromium version is not installed).

---

## Approved infrastructure updates (2026-11-25). These take precedence over older infrastructure text below

Approved by the team; everything else in this brief is unchanged. Details and rationale: `DECISIONS.md`, `docs/ARCHITECTURE.md`.

| Area | Decision |
|---|---|
| UI/UX generation | ~~v0 by Vercel~~ not used: the UI was built directly in `frontend/` (see Design system above) |
| Frontend | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, deployed on **Vercel** (root directory `frontend/`) |
| API gateway | **Next.js server route handlers** (`frontend/app/api/*`) are the only API the browser calls. They hold all secrets |
| Database | **Supabase PostgreSQL** replaces SQLite/in-memory storage. Schema in `supabase/migrations/`, RLS on, no anon access |
| Image storage | **Supabase Storage**, private bucket `retina-uploads`, short-lived signed upload URLs, object deleted right after inference |
| Realtime | Supabase Realtime **broadcast** (`clinic-queue`) tells open clinic queues to refetch; carries no patient data |
| ML inference | **FastAPI** Python service (unchanged role) on **Hugging Face Spaces (Docker)**; called server-to-server with `X-API-Key` |
| Model weights | Hugging Face Hub model repo (`HF_MODEL_REPO`), downloaded at service startup; never committed to git |
| Patient reports | **Fixed Urdu/English templates** in production (no LLM key). Optional LLM rewording of the explanation paragraph only (code supports Anthropic; Gemini may be added) |
| Accounts & roles (2026-11-26, team lead decision; overrides §2.5 "user accounts and authentication" out of scope) | **Supabase Auth** with roles operator / specialist / clinic admin / patient, patient records per clinic, referral follow-up, patient portal, audit log. Access enforced by RLS. See `docs/SECURITY.md` |

Resulting API split: the browser talks to `frontend/app/api/*` (`/api/uploads/sign`, `/api/screen`, `/api/screenings/[id]`,
`/api/reports/[id]`, `/api/reports/[id]/pdf`, `/api/queue`, `/api/metrics`, `/api/health`); those routes call Supabase and the
FastAPI service (`/health`, `/predict`, `/gradcam`, `/generate-pdf`, `/metrics`). See `docs/API_DOCUMENTATION.md`.

---

## 0. Competition context (hard constraints)

- **Event:** Capital Youth Expo Hackathon (Innovation Sprint), Rulebook No. 04, competition code 04-HK.
- **Track:** Track 2, Healthcare.
- **Submission deadline:** **Nov 28, 2026, 11:59 PM** (Pakistan time). Our build budget is **24 hours**.
- **Grand Finale:** Dec 2, 2026. 5-minute live pitch plus 2 minutes of jury Q&A. Arrive at least 15 minutes early, or the team forfeits.
- **Required deliverables:**
  1. A public GitHub repo with full source code and a clear `README.md`.
  2. A working **live deployment link**.
  3. A recorded **video walkthrough of no more than 2 minutes**.
  4. A **pitch deck** (PDF or PPTX).
- **Rules that affect the code:**
  - Every external API, library, pretrained weight and dataset **must be disclosed in README.md**.
  - The core application logic must be written during the competition window. Pretrained backbones (ImageNet weights) and public datasets are allowed as long as they are disclosed.
  - Feature freeze at submission. After that, only small environment or config fixes are allowed.
- **Judging (each 25%):** Innovation, Technical Execution, Real-World Impact, and Presentation/UI/UX/Pitch. **The UI must look polished, because it is a quarter of the score.**

---

## 1. The problem

### 1.1 What diabetic retinopathy (DR) is
- High blood sugar damages the small blood vessels of the retina. They leak, bleed, and eventually grow fragile new vessels that can cause sudden blindness.
- **It causes no symptoms until it is advanced.** Once vision is lost, it usually cannot be restored.
- Treatment (laser therapy, anti-VEGF injections) **prevents** vision loss if the disease is caught early.
- So the whole fight comes down to one step: **every diabetic patient's retina needs to be examined about once a year.**

### 1.2 Why Pakistan specifically
| Fact | Source |
|---|---|
| Pakistan has the **highest diabetes prevalence in the world**: 31.4% of adults aged 20–79 (age-standardised) | IDF Diabetes Atlas, 11th ed. (2025) |
| **34.5 million** adults with diabetes in 2024, projected to reach **70.2 million by 2050** | IDF Diabetes Atlas: https://diabetesatlas.org/data-by-location/country/pakistan |
| Only **15 ophthalmologists per million people** | Express Tribune, Aug 2026: https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan |
| In Pakistan, diabetic patients are **not routinely screened for DR** | Rural Pakistan DR study (PMC9940560): https://pmc.ncbi.nlm.nih.gov/articles/PMC9940560 |
| Worldwide, about **27%** of diabetics have some form of DR (meta-analysis, 2015–2018) | Same study as above |
| DR care in Pakistan is limited by the **shortage of ophthalmologists** | Shah et al., task-sharing study (Univ. of Melbourne) |

**Rough scale (our own estimate, label it as one):** 27% × 34.5M ≈ **9 million Pakistanis may have some DR**, and most have never had a retinal exam.

### 1.3 The bottleneck we remove
Grading a retinal photo needs a specialist. Even if every ophthalmologist in Pakistan did nothing but screening, they could not grade 34M+ patients a year. Human capacity cannot close this gap, but automated reading can.

### 1.4 Proof that AI screening works
- **IDx-DR** (now LumineticsCore) was the **first FDA-cleared autonomous AI diagnostic system** (April 2018). Primary care providers use it to screen diabetic patients without an eye specialist reading the images.
- In its 900-patient trial it achieved **87% sensitivity and 90% specificity** for "more than mild" DR.
- Sources: https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f and https://chiefhealthcareexecutive.com/view/the-numbers-behind-the-first-fdaapproved-autonomous-ai-diagnostic-system
- **This is our benchmark.** We report our numbers next to it.

---

## 2. What we are building

### 2.1 One-line pitch
> "Pakistan has the world's highest diabetes rate and 15 eye doctors per million people. Millions are going blind from a disease that's preventable if caught early. NazarAI screens a retina photo in seconds, so specialists only see the patients who need them."

### 2.2 Users and scenario
- **Operator:** A health worker, nurse or GP at a diabetes clinic or Basic Health Unit (not an eye specialist). They take the retina photo.
- **Patient:** An adult with diabetes. They receive a simple report in Urdu or English.
- **Specialist:** An ophthalmologist who only receives referred patients, already sorted by urgency.

### 2.3 User flow
1. The operator enters basic patient info (name or ID, age, years with diabetes). Keep it optional and minimal.
2. The operator uploads or captures a **fundus (retina) photo**.
3. **Quality gate:** if the image is blurry, too dark or not a retina, ask for a retake.
4. **AI grading:** predict the DR grade (0–4) and give a confidence score.
5. **Referral decision:**
   - Grade 0–1 → ✅ "No referable DR, rescreen in 12 months"
   - Grade 2 → ⚠️ "Refer to an eye specialist"
   - Grade 3–4 → 🔴 "Refer URGENTLY"
6. **Explainability:** a Grad-CAM heatmap over the retina showing where the model sees lesions.
7. **Patient report:** a plain-language explanation in **Urdu and English**, plus a downloadable PDF referral slip.
8. **Clinic dashboard:** the day's screened patients, sorted by urgency, with counts.

### 2.4 DR grading scale (International Clinical DR scale, same as the datasets)
| Grade | Stage | Action |
|---|---|---|
| 0 | No DR | Rescreen in 12 months |
| 1 | Mild NPDR | Rescreen in 12 months |
| 2 | Moderate NPDR | **Refer** |
| 3 | Severe NPDR | **Refer urgently** |
| 4 | Proliferative DR | **Refer urgently** (risk of blindness) |

**"Referable DR" = grade ≥ 2.** This binary decision is the one that matters most. Optimise for it.

### 2.5 Scope
**In scope:** 5-class DR grading, a referable/not-referable decision, a quality gate, Grad-CAM, an Urdu/English report, PDF referral slip, clinic dashboard, a model-performance page.

**Out of scope (mention as "future work" in the pitch):**
- Diabetic macular edema (DME) grading. Most datasets don't label it.
- Other eye diseases (glaucoma, cataract).
- Real EHR integration, user accounts and authentication.
- Training on Pakistani clinical data (future pilot with a local eye hospital).
- Smartphone fundus adapter hardware.

---

## 3. Data

> ⚠️ The full EyePACS dataset is about 80+ GB. **Do NOT download it to a laptop.** Train in **Kaggle Notebooks** (free GPU, and the datasets are already mounted) or use the pre-resized community copies.

| Dataset | Size | Labels | Role | Notes |
|---|---|---|---|---|
| **APTOS 2019 Blindness Detection** (Kaggle) | 3,662 train images | Grades 0–4 | Training + validation | Collected in India (Aravind), the closest population to Pakistan. Highlight this in the pitch. |
| **EyePACS / Kaggle DR Detection 2015** | ~35k train (+~53k test with released labels) | Grades 0–4 | Main training data | Use a **pre-resized Kaggle copy** (search Kaggle for "resized 2015 2019 blindness detection images"). |
| **IDRiD** | 516 grading images; 81 with lesion masks | Grades 0–4 + lesion segmentation | **External test** + checking that Grad-CAM lands on real lesions | Indian population. |
| **Messidor-2** | 1,748 images | Adjudicated grades (third party) | Optional external test | Requires registration. Skip it if access takes too long. |
| **EyeQ** (optional) | ~28k EyePACS images | Quality: Good / Usable / Reject | Training the quality gate | Use only if time allows. Otherwise use the heuristic gate (Section 4.1). |

**Splits:**
- Train/validation on EyePACS + APTOS, stratified by grade, with **patient-level split** where patient IDs exist (EyePACS has left and right eyes per patient, so never put the same patient in both train and validation).
- **External test = IDRiD**, never used for training or threshold tuning. This is what makes our accuracy claim credible.

**Class imbalance:** Grade 0 dominates the data. Use stratified sampling and/or class-weighted loss, and report per-class metrics.

All dataset names, links and licences go in README.md.

---

## 4. ML pipeline

### 4.1 Image quality gate (fast, runs first)
Heuristics in OpenCV. No training needed:
- **Blur:** variance of the Laplacian is below a threshold → "image is blurry, retake".
- **Exposure:** mean brightness of the retina area is too low or too high → "too dark or overexposed".
- **Is it a retina?** Threshold the image and check that a large circular bright region exists. Optionally use a tiny CNN "retina vs not-retina" check.
- Tune thresholds on a handful of good and bad images, and make them configurable.
- Optional upgrade if time allows: a small quality classifier trained on EyeQ.

### 4.2 Preprocessing (identical in training and inference; put it in one shared module)
1. **Crop the black border** around the circular fundus (threshold, then crop to the bounding box).
2. **Resize** to 384×384 to start (512 if time and GPU allow).
3. **Ben Graham's preprocessing** (from the 2015 Kaggle winner): `img = 4*img - 4*GaussianBlur(img, sigma≈size/30) + 128`, then apply a circular mask. This brings out lesions and evens out lighting.
4. Normalise with ImageNet mean and std.

### 4.3 Model
- **Library:** PyTorch + `timm`.
- **Backbone:** `efficientnet_b3` (or `convnext_tiny`) with ImageNet weights. Start with one strong model, and add a second backbone for an ensemble only if time remains.
- **Head:** a **single regression output** (predicts a continuous grade from 0 to 4), trained with SmoothL1/MSE. Then **optimise class thresholds** on validation to maximise Quadratic Weighted Kappa. This beats plain 5-class softmax for ordinal grading (the standard APTOS-winning approach).
- **Referable DR score:** derived from the regression output (grade ≥ 2 after thresholds). Choose the referral threshold for **high sensitivity (target ≥ 87%)**. A false referral costs one visit; a miss can cost someone's sight.
- **Training:**
  - AdamW, lr ~1e-4 (backbone) and higher for the head, cosine schedule, a short warmup.
  - Mixed precision (AMP). Batch size as large as the GPU allows.
  - Augmentations (albumentations): horizontal and vertical flips, rotation (±180°, since fundus images have no fixed orientation), small scale/shift, slight brightness/contrast. **Avoid heavy colour or hue shifts**, because lesion colour matters.
  - Budget about 6–8 GPU hours in total. Save the best checkpoint by validation QWK.
- **Test-time augmentation:** average predictions over flips.

### 4.4 Evaluation (results go on the "Model Performance" page and in the deck)
Report on the validation set **and** on the external test set (IDRiD):
- **Quadratic Weighted Kappa (QWK)** for the 0–4 grade.
- For **referable DR (grade ≥ 2)**: **sensitivity, specificity, AUC-ROC**, PPV and NPV.
- 5×5 confusion matrix.
- ROC curve with the chosen operating point marked.
- A table comparing our results with **IDx-DR (87% sensitivity / 90% specificity)**.
- Throughput: average inference time per image on CPU.
- Save everything to `ml/reports/metrics.json` and image files so the frontend can show them.

**Honesty rule:** report the real numbers, even if they fall below the benchmark. Never tune on the test set.

### 4.5 Explainability
- **Grad-CAM** (`pytorch-grad-cam`) on the last convolutional block, overlaid on the original retina.
- Validate qualitatively on IDRiD images that have lesion masks: show 2–3 side-by-side examples (heatmap next to the true lesion mask) in the deck.

### 4.6 Export for deployment
- Export the final model to **ONNX** and run it with `onnxruntime` on CPU, so the free CPU hosting is fast enough.
- Keep PyTorch available in the backend just for Grad-CAM. Alternatively, precompute Grad-CAM with the PyTorch model on CPU (about 1–2 s per image is fine).

---

## 5. Application

### 5.1 Stack
| Layer | Choice |
|---|---|
| Training | Kaggle Notebooks (GPU) or Colab, PyTorch, timm, albumentations, scikit-learn |
| Backend | **FastAPI** (Python 3.11), onnxruntime, OpenCV, pytorch-grad-cam |
| LLM (patient report) | Claude API (Anthropic). Generates the Urdu/English explanation **from the model output only** |
| PDF | ReportLab or WeasyPrint |
| Frontend | **Next.js + TypeScript + Tailwind + shadcn/ui** (polished UI is 25% of the score) |
| Storage | ~~SQLite (demo only), or in-memory~~ → **Supabase PostgreSQL + private Supabase Storage** (see Approved infrastructure updates) |
| Deployment | Backend → **Hugging Face Spaces (Docker)**. Frontend → **Vercel**. Database/storage → **Supabase** |

### 5.2 Backend API
> Updated: this contract is now served by the Next.js route handlers (gateway) backed by the FastAPI service. `POST /api/screen` takes a temporary storage path instead of a multipart body; `POST /api/report/{id}` is `POST /api/reports/{id}`. See `docs/API_DOCUMENTATION.md`.
```
POST /api/screen            multipart: image (+ optional patient fields)
  → {
      quality: { ok: bool, issues: [str], blur_score, brightness },
      grade: int (0-4),
      grade_label: str,
      continuous_score: float,
      confidence: float,
      referable: bool,
      urgency: "routine" | "refer" | "urgent",
      recommendation_en: str,
      heatmap_png_base64: str,
      processed_png_base64: str,
      screening_id: str
    }
POST /api/report/{screening_id}   body: { language: "ur" | "en" }
  → { text: str }                 LLM explanation, grounded in the stored result
GET  /api/report/{screening_id}/pdf  → referral slip PDF
GET  /api/queue                   → today's screenings sorted by urgency
GET  /api/metrics                 → contents of metrics.json for the performance page
GET  /api/health
```
- Validate the file type and size, and process images in memory. Uploaded images live only briefly in the private Supabase bucket and are deleted right after inference.
- **The LLM never makes or changes the medical decision.** It only explains the model's output in simple language, and every report includes the disclaimer (Section 7).
- If the Claude API fails, fall back to a fixed template report in both languages.

### 5.3 Frontend pages
1. **Landing / Pitch page:** the problem in 3 stats (34.5M diabetics, #1 diabetes rate worldwide, 15 eye doctors per million), a "Start screening" button, and a short "how it works" section.
2. **Screen page (the core demo):**
   - Drag-and-drop upload, plus a "Try a sample image" button with 4–5 bundled demo images (one per grade, including one bad-quality image).
   - Quality result → grade card (colour-coded green/amber/red) → referral decision → **side-by-side original and heatmap** with an opacity slider.
   - "Generate patient report" button with an **Urdu/English toggle**. Urdu text needs `dir="rtl"` and a proper Nastaliq/Naskh web font (e.g., Noto Nastaliq Urdu).
   - "Download referral slip (PDF)" button.
3. **Clinic Queue:** a table of today's screenings sorted by urgency, with counters (Urgent / Refer / Routine).
4. **Model Performance:** QWK, sensitivity, specificity and AUC; confusion matrix; ROC curve; comparison table with IDx-DR; the datasets used.
5. **About / Safety:** intended use, limitations, disclaimer.

Design: clean medical look (white, deep teal or blue, plenty of whitespace), large readable type, mobile-responsive (a health worker may use a tablet). Use loading skeletons and a smooth result animation, since the demo happens live on stage.

---

## 6. Repo structure
```
nazarai/
├── CLAUDE.md                 # this file
├── README.md                 # required: setup, usage, ALL disclosures
├── DECISIONS.md              # short log of choices made
├── ml/
│   ├── notebooks/            # Kaggle training notebook(s)
│   ├── src/
│   │   ├── preprocess.py     # shared preprocessing (also used by the backend)
│   │   ├── quality.py        # quality gate
│   │   ├── dataset.py
│   │   ├── train.py
│   │   ├── evaluate.py       # writes reports/metrics.json + plots
│   │   ├── thresholds.py     # QWK threshold optimisation
│   │   └── export_onnx.py
│   ├── reports/              # metrics.json, confusion_matrix.png, roc.png, gradcam examples
│   └── weights/              # (gitignored if large; host on HF Hub and download at startup)
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── inference.py
│   │   ├── gradcam.py
│   │   ├── report_llm.py
│   │   ├── pdf.py
│   │   └── schemas.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js app (Vercel): pages, components, app/api/* gateway routes
├── supabase/                 # migrations/ (schema, RLS, storage bucket, realtime trigger), seed.sql, config.toml
├── docs/                     # ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, DEPLOYMENT, V0_UI_PROMPT
├── scripts/                  # deploy_hf_space.py, upload_model.py, make_pipeline_test_model.py
└── demo_images/              # 5 sample fundus images from public datasets (check licences)
```
> Note: the shared ML code lives in the package `ml/src/nazarai_ml/` (preprocess.py, quality.py, dataset.py, train.py, evaluate.py, thresholds.py, export_onnx.py, plus decision.py, scorer.py, metrics.py, model.py, idrid_hf.py).
Model weights: if over about 100 MB, upload them to the Hugging Face Hub and download at backend startup.

---

## 7. Safety, ethics and wording (required)
- Wording: **"screening / triage support"**, never "diagnosis". Every result and report carries:
  > "This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment."
  > Urdu: "یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔"
- The threshold favours **sensitivity** (better to over-refer than miss).
- Low-quality images are **rejected**, not graded.
- When uncertain (continuous score near a threshold, or low confidence), the system says "refer", never "you're fine".
- **No real patient data.** The demo only uses public dataset images and synthetic patient references. Only screening metadata persists (Supabase PostgreSQL); retinal images are never stored permanently.
- The LLM explains only. It cannot override the grade or referral.

---

## 8. 24-hour plan

**Team:** Hassan (ML lead) plus 3 ML engineers (ML-2, ML-3, ML-4) and 1 first-year student (F). Two Claude Code instances:
- **Claude Code A:** `ml/` + `backend/`
- **Claude Code B:** `frontend/` + deployment config

> Infrastructure note: "Deploy backend (HF Spaces/Render)" now means HF Spaces + Supabase project setup; see `docs/DEPLOYMENT.md`.

| Hours | Hassan (ML lead) | ML-2 (data/eval) | ML-3 (backend) | ML-4 (frontend) | F (first-year) |
|---|---|---|---|---|---|
| 0–1 | Kick-off: read this file together, create the repo, add CLAUDE.md | Set up the Kaggle notebook, attach the datasets | Scaffold FastAPI (Claude Code A) | Scaffold Next.js (Claude Code B) | Create the deck outline, collect sources |
| 1–4 | Preprocessing + dataset + training script; **start first training run by hour 4** | Patient-level splits, quality-gate heuristics, pick demo images | `/api/screen` with a **dummy model** returning a fake grade | Landing + Screen page UI against mock API data | README skeleton with all disclosures |
| 4–10 | Monitor training; second run with tweaks (resolution, augmentations) | `evaluate.py` + threshold optimisation + IDRiD external-test pipeline | Grad-CAM, LLM report, PDF, queue endpoint | Results UI, heatmap slider, Urdu RTL report, queue page | Deck: problem and solution slides |
| 10–14 | Pick the best checkpoint, export ONNX | Run full evaluation → `metrics.json` + plots | Swap in the real ONNX model; end-to-end test | Model Performance page from `/api/metrics` | Write the video script (≤ 2 min) |
| 14–18 | Grad-CAM vs IDRiD lesion-mask examples for the deck | Robustness checks (bad images, edge cases) | Deploy backend (HF Spaces/Render) | Deploy frontend (Vercel), connect to the live backend | Test the live app like a real user, log bugs |
| 18–21 | Bug fixes, final numbers into the deck | Final metrics table vs IDx-DR | Bug fixes, `tests/` | UI polish, mobile check | Finish the deck |
| 21–23 | **Record the 2-min video** (everyone) | | | | |
| 23–24 | Final README check, disclosures, links. **Submit with a buffer before Nov 28 11:59 PM** | | | | |

**Critical-path rule:** the app must work end-to-end with a dummy model by **hour 4**, so frontend and backend never wait for training. Swap in the real model as soon as it exists.

**If behind schedule, cut in this order:** clinic queue → PDF → ensemble → EyeQ quality model. **Never cut:** the quality gate, Grad-CAM, the metrics page, the live deployment.

---

## 9. README.md must include
- Project name, one-line pitch, problem statistics with sources.
- Live demo link, video link.
- Architecture diagram (simple flow).
- Setup and run instructions (backend, frontend, training).
- **Disclosures:** every dataset (with link and licence), pretrained weights (timm ImageNet), libraries (PyTorch, timm, albumentations, OpenCV, FastAPI, onnxruntime, pytorch-grad-cam, Next.js, Tailwind, shadcn/ui, ReportLab), APIs (Anthropic Claude API), hosting (Hugging Face Spaces, Vercel, Supabase), UI generation (v0 by Vercel). Also state that AI coding assistants (Claude Code) were used.
- Model results (validation + external test) vs the IDx-DR benchmark.
- Intended use, limitations, safety disclaimer.
- Team members.

---

## 10. Pitch deck outline (5 minutes)
1. **Hook:** "Pakistan: #1 in the world for diabetes. 15 eye doctors per million people."
2. **Problem:** DR is silent, preventable and unscreened. About 9M people may be affected (our estimate).
3. **Why now:** AI screening is proven (FDA-cleared IDx-DR, 87%/90%).
4. **Solution:** NazarAI flow (photo → quality → grade → heatmap → Urdu report → referral).
5. **Live demo** (about 90 s): good image → urgent referral with heatmap → Urdu report; bad image → rejected.
6. **Tech:** pipeline, datasets, external validation.
7. **Results:** our sensitivity/specificity/QWK vs IDx-DR; Grad-CAM vs real lesions.
8. **Impact & adoption:** diabetes clinics, BHUs, eye hospitals (Al-Shifa, LRBT), government health programmes. One camera per clinic plus our software, and specialists only see referrals.
9. **Roadmap:** DME, pilot on Pakistani data with an eye hospital, smartphone fundus adapters, offline/edge version.
10. **Ask / close.**

## 11. Likely jury questions and answers
- **"Where do retina photos come from?"** One fundus camera shared per clinic. Low-cost smartphone fundus adapters are on the roadmap. Today's demo uses public dataset images.
- **"Does it replace doctors?"** No. It handles routine screening so specialists only see patients who need treatment. IDx-DR set the precedent.
- **"Will it work on Pakistani patients?"** Validated on South Asian data (APTOS from India, IDRiD from India) as an external test. Next step is a pilot with a local eye hospital.
- **"What if it's wrong?"** The threshold favours sensitivity, low-quality images are rejected, borderline cases get referred, and there's a heatmap for a human to check. It's screening, not diagnosis.
- **"What's original here?"** The full Pakistan-specific screening workflow: quality gate, ordinal grading with an optimised referral threshold, explainability validated against lesion masks, Urdu reports, clinic triage queue. All built in this window.

---

## 12. Working rules for Claude Code
- Keep preprocessing in **one shared module** used by both training and inference. A mismatch here silently ruins accuracy.
- Build so it works end-to-end first, then improve: dummy model first, real model later.
- Write small, readable modules. Add basic tests for `/api/screen`, preprocessing and the quality gate.
- Never commit API keys. Use `.env`, and commit a `.env.example`.
- Pin dependency versions in `requirements.txt` and `package.json`.
- Log each significant decision in `DECISIONS.md` (one line each).
- Update README disclosures whenever a new library, model, dataset or API is added.
