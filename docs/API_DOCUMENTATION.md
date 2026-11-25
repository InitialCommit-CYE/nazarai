# API documentation

All errors are JSON: `{"error": "<human message>", "code": "<machine code>"}`.
Common codes: `invalid_request` 400, `invalid_id` 400, `not_found` 404, `not_graded` 409, `invalid_image` 422,
`rate_limited` 429 (with `Retry-After`), `ml_unreachable` 502, `db_error` 502, `not_configured` 503,
`model_unavailable` 503, `untrained_model` 503, `ml_timeout` 504.

## Next.js gateway (`frontend/app/api`): called by the browser

### `POST /api/uploads/sign`
Body `{"contentType": "image/jpeg"|"image/png"|"image/webp", "size": <bytes ≤ 10485760>}`
→ `200 {"path": "incoming/<uuid>.jpg", "token", "signedUrl", "bucket"}`. Upload with
`PUT signedUrl` (multipart: `cacheControl`, file part named `""`; header `apikey: <publishable key>`). Limit 30/min/IP.

### `POST /api/screen`
Body `{"uploadPath": "incoming/<uuid>.<ext>", "imageSource": "upload"|"sample"|"camera", "demoPatientCode"?: string, "age"?: 18-120, "diabetesDurationYears"?: 0-80}`
→ `201 {"screening": ScreeningRecord, "images": {"display", "processed", "heatmap"} | null, "timings_ms"}`.
Rejected images return `screening.quality_ok = false`, `grade = null`, `images = null`. The upload is always deleted.
Limit 12/min/IP. `maxDuration` 120 s (ML cold starts).

### `GET /api/screenings/{id}`
→ `200 {"screening": ScreeningRecord}` · 400 invalid UUID · 404.

### `POST /api/reports/{id}`
Body `{"language": "en"|"ur", "regenerate"?: boolean}` → `200 {"screening_id", "language", "body", "generator": "claude"|"template", "llm_model", "created_at"}`.
409 when the screening was rejected by the quality gate. Cached per language in `screening_reports`.

### `GET /api/reports/{id}/pdf?lang=en|ur`
→ `200 application/pdf` (attachment) referral slip, rendered by the ML service.

### `GET /api/queue?scope=today|all`
→ `200 {"scope", "counts": {"total", "urgent", "refer", "routine", "rejected"}, "items": ScreeningRecord[]}`;
items sorted urgent → refer → routine → rejected, newest first; "today" = Pakistan time. Max 300 rows.

### `GET /api/metrics`
→ contents of `ml/reports/metrics.json` (`status: "complete"`) or `{"status": "pending"|"unavailable", "detail"}`. Never synthesised.

### `GET /api/health`
→ `200|503 {"status": "ok"|"degraded", "checks": {config, database, storage, ml_service, llm}, "time"}`.

## FastAPI ML service (`backend/app`): called only by the gateway
All endpoints except `/health` require `X-API-Key: $ML_SERVICE_API_KEY`. Interactive docs at `/docs` outside production.

| Method & path | Request | Response |
|---|---|---|
| `GET /health` | – | `{status, model_loaded, model{model_version, backbone, image_size, trained}, gradcam_available, metrics_available, app_env, detail}` |
| `POST /predict?gradcam=true` | multipart `image` (JPEG/PNG/WebP ≤ 10 MB) | `PredictResponse` below; 415 type, 413 size, 422 undecodable, 503 no model |
| `POST /gradcam` | multipart `image` | same as `/predict` with Grad-CAM required (503 if PyTorch weights missing) |
| `POST /generate-pdf` | `PdfRequest` JSON | `application/pdf` |
| `GET /metrics` | – | metrics.json or `{status: "pending"}` |

`PredictResponse`
```json
{
  "quality": {"ok": true, "issues": [], "blur_score": 38.0, "brightness": 94.1, "green_mean": 70.3, "saturated_fraction": 0.0,
              "fundus_fraction": 0.69, "circularity": 0.88, "dark_corners": 4, "red_blue_ratio": 9.1},
  "grading": {"grade": 3, "grade_label": "Severe NPDR", "continuous_score": 3.08, "confidence": 0.79, "referable": true,
              "urgency": "urgent", "borderline": false, "recommendation_en": "...", "decision_reason": "...",
              "tta_scores": [3.1, 3.0, 3.1, 3.1]},
  "images": {"display_png_base64": "...", "processed_png_base64": "...", "heatmap_png_base64": "..."},
  "model": {"model_version": "...", "backbone": "efficientnet_b3", "image_size": 384, "trained": true},
  "timings_ms": {"quality": 21, "inference": 256, "gradcam": 1103, "total": 1486}
}
```
(Values illustrative of the shape only.)

`PdfRequest`: `screening_id, created_at, demo_patient_code?, age?, diabetes_duration_years?, grade, grade_label, confidence, referable, urgency, model_version, is_development_model, language ("en"|"ur"), report_text`.
