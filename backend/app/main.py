"""NazarAI ML inference service (FastAPI). Called server-to-server by the Next.js API routes.

Endpoints
    GET  /health         public; model/Grad-CAM/metrics availability
    POST /predict        multipart "image": quality gate -> grade -> referral -> Grad-CAM
    POST /gradcam        multipart "image": same pipeline, always with Grad-CAM
    POST /generate-pdf   JSON PdfRequest -> application/pdf referral slip
    GET  /metrics        contents of ml/reports/metrics.json, or {"status": "pending"}
All endpoints except /health require the X-API-Key header.
"""
from __future__ import annotations

import hmac
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

from .config import Settings, get_settings
from .inference import model_info, run_screening
from .model_store import ModelStore
from .pdf import build_referral_pdf
from .schemas import HealthResponse, PdfRequest, PredictResponse

from nazarai_ml.preprocess import ImageDecodeError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("nazarai.api")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.is_production and not settings.ml_service_api_key:
        log.error("ML_SERVICE_API_KEY is not set: protected endpoints will refuse all requests")
    store = ModelStore(settings)
    store.load()
    app.state.store = store
    yield


app = FastAPI(title="NazarAI ML service", version="1.0.0", lifespan=lifespan,
              docs_url=None if get_settings().is_production else "/docs", redoc_url=None)


def require_api_key(x_api_key: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> None:
    expected = settings.ml_service_api_key
    if not expected:
        if settings.is_production:
            raise HTTPException(503, "service misconfigured: API key not set")
        return  # local development without a key
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(401, "invalid or missing API key")


def get_store() -> ModelStore:
    return app.state.store


async def read_upload(image: UploadFile, settings: Settings) -> bytes:
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"unsupported image type {image.content_type!r}; use JPEG, PNG or WebP")
    limit = int(settings.max_upload_mb * 1024 * 1024)
    data = await image.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"image larger than {settings.max_upload_mb:g} MB")
    if not data:
        raise HTTPException(422, "empty image")
    return data


@app.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    store = get_store()
    m = store.model
    return HealthResponse(
        status="ok" if m else "degraded",
        model_loaded=m is not None,
        model=model_info(m) if m else None,
        gradcam_available=bool(m and m.torch_model is not None),
        metrics_available=settings.metrics_path.exists(),
        app_env=settings.app_env,
        detail=store.error,
    )


def _screen(data: bytes, with_gradcam: bool) -> PredictResponse:
    m = get_store().model
    if m is None:
        raise HTTPException(503, "model not loaded; no prediction can be made")
    try:
        return run_screening(data, m, with_gradcam=with_gradcam)
    except ImageDecodeError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/predict", response_model=PredictResponse, dependencies=[Depends(require_api_key)])
async def predict(image: UploadFile = File(...), gradcam: bool = True, settings: Settings = Depends(get_settings)):
    data = await read_upload(image, settings)
    from starlette.concurrency import run_in_threadpool

    return await run_in_threadpool(_screen, data, gradcam)


@app.post("/gradcam", response_model=PredictResponse, dependencies=[Depends(require_api_key)])
async def gradcam(image: UploadFile = File(...), settings: Settings = Depends(get_settings)):
    data = await read_upload(image, settings)
    m = get_store().model
    if m is not None and m.torch_model is None:
        raise HTTPException(503, "Grad-CAM unavailable: PyTorch weights not loaded")
    from starlette.concurrency import run_in_threadpool

    return await run_in_threadpool(_screen, data, True)


@app.post("/generate-pdf", dependencies=[Depends(require_api_key)])
def generate_pdf(req: PdfRequest) -> Response:
    pdf = build_referral_pdf(req)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="nazarai-referral-{req.screening_id[:8]}.pdf"'})


@app.get("/metrics", dependencies=[Depends(require_api_key)])
def metrics(settings: Settings = Depends(get_settings)) -> JSONResponse:
    path = settings.metrics_path
    if not path.exists():
        return JSONResponse({"status": "pending", "detail": "Model evaluation has not been published yet."})
    try:
        return JSONResponse(json.loads(path.read_text(encoding="utf-8")))
    except json.JSONDecodeError as exc:
        raise HTTPException(500, "metrics.json is malformed") from exc
