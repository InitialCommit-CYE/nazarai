# NazarAI architecture

```
                 v0 (UI generation) ──► Next.js components (frontend/)
                                                 │
 Browser ── HTTPS ──► Vercel: Next.js App Router ┤ pages: / · /screen · /screenings/[id](/explain,/report) · /queue · /performance · /about
   │                                             └ app/api/* route handlers (API gateway, holds every secret)
   │                                                     │                     │                         │
   │  signed upload URL (PUT)                            │ service-role key    │ X-API-Key               │ ANTHROPIC_API_KEY
   └──────────────► Supabase Storage (private) ◄─────────┤                     ▼                         ▼
                                                          │        Hugging Face Space (Docker)     Anthropic Claude API
   Realtime broadcast  ◄── Supabase Realtime ◄── trigger ─┤        FastAPI ML service              (explanation text only)
   "clinic-queue"                                         │        quality gate → preprocess →
                                                          ▼        ONNX grading (4-view TTA) →
                                               Supabase PostgreSQL decision rule → Grad-CAM → PDF
                                               screenings, screening_reports      ▲
                                                                                  │ weights at startup
                                                                       Hugging Face Hub model repo
```

## Screening data flow
1. **Select**: the operator picks a file, uses the camera input, or a bundled IDRiD sample. The browser checks type (JPEG/PNG/WebP) and size (≤ 10 MB).
2. **Sign**: `POST /api/uploads/sign` mints a signed upload URL for `incoming/<uuid>.<ext>` in the private `retina-uploads` bucket.
3. **Upload**: the browser `PUT`s the file straight to Supabase Storage (progress bar via XHR). No image bytes pass through Vercel.
4. **Screen**: `POST /api/screen {uploadPath, patient fields}`. The route validates the path pattern, downloads the object with the service-role key and forwards it to FastAPI `/predict`.
5. **Inference** (FastAPI): decode → **quality gate** (rejects stop here, never graded) → shared preprocessing → ONNX Runtime on 4 flipped views → `decision.decide()` (grade, referable, urgency, borderline, confidence) → Grad-CAM (PyTorch) → PNGs.
6. **Delete**: the route removes the upload in a `finally` block, whatever happened.
7. **Persist**: metadata (no images) is inserted into `public.screenings`; DB constraints enforce the safety invariants; the insert trigger broadcasts `{id, urgency}` on `clinic-queue`.
8. **Return**: result plus images (data URLs) go to the browser, which keeps the images only in `sessionStorage` and navigates to `/screenings/<id>`.
9. **Report**: `POST /api/reports/<id>` builds the explanation from the stored result (Claude or template) and caches it in `screening_reports`; `GET /api/reports/<id>/pdf?lang=ur|en` asks FastAPI to render the referral slip.
10. **Queue**: `/queue` reads `GET /api/queue` (urgent → refer → routine, newest first) and refetches on every broadcast (30 s polling fallback).

## Responsibilities
| Component | Owns | Never does |
|---|---|---|
| Browser | UI state, direct signed upload, session-only images, Realtime subscription | Hold privileged keys, read tables |
| Next.js routes | Validation, rate limiting, Supabase access, ML/LLM calls, upload deletion | Run ML, store images |
| FastAPI | Quality gate, preprocessing, inference, Grad-CAM, PDF, metrics file | Talk to the database, keep images |
| Supabase | Persistent metadata, private temporary storage, Realtime | Expose rows to anon |
| Claude | Rewording an existing result in Urdu/English | Decide or change grade/referral |

## Model lifecycle
Kaggle notebook (`ml/notebooks/nazarai_train_kaggle.ipynb`) → `model.pt` + `model_config.json` (validation-fitted thresholds) → `model.onnx` (parity-checked) → `evaluate.py` → `ml/reports/metrics.json` → weights to a private HF model repo (`scripts/upload_model.py`) → the Space downloads them at startup → `/metrics` serves the report to the Performance page.

## Safety interlocks (defence in depth)
- Quality gate rejects before grading; DB constraint `screenings_graded_iff_quality_ok`.
- Grade 3–4 must be urgent, grade ≥ 2 must be referable (`decision.py` + DB constraints).
- Untrained artefacts: `trained:false` → refused by the backend in production, by `/api/screen` outside development, and bannered in the UI.
- LLM: explanation only, validated, template fallback; decision text is never LLM-generated.
