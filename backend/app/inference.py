"""Screening pipeline: decode -> quality gate -> preprocess -> ONNX grading (TTA) -> decision -> Grad-CAM."""
from __future__ import annotations

import base64
import logging
import time

import cv2
import numpy as np

from nazarai_ml.decision import decide
from nazarai_ml.preprocess import decode_image
from nazarai_ml.quality import assess_quality

from .model_store import LoadedModel
from .schemas import GradingOut, ImagesOut, ModelInfo, PredictResponse, QualityOut

log = logging.getLogger("nazarai.inference")


def png_b64(img: np.ndarray) -> str:
    """Encode RGB or RGBA uint8 as base64 PNG."""
    if img.ndim == 3 and img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    else:
        bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    if not ok:
        raise RuntimeError("PNG encoding failed")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def model_info(m: LoadedModel) -> ModelInfo:
    return ModelInfo(model_version=m.config.model_version, backbone=m.config.backbone,
                     image_size=m.config.image_size, trained=m.trained)


def run_screening(data: bytes, m: LoadedModel, with_gradcam: bool = True) -> PredictResponse:
    timings: dict[str, float] = {}
    t0 = time.perf_counter()
    img = decode_image(data)  # raises ImageDecodeError -> 422 in the route

    quality = assess_quality(img)
    timings["quality"] = round((time.perf_counter() - t0) * 1000, 1)
    q_out = QualityOut(**quality.to_dict())
    if not quality.ok:
        # Rejected images are NEVER graded.
        return PredictResponse(quality=q_out, model=model_info(m), timings_ms=timings)

    t1 = time.perf_counter()
    mean_score, views, prepared, x = m.scorer.score(img)
    decision = decide(mean_score, views, m.config.decision_config())
    timings["inference"] = round((time.perf_counter() - t1) * 1000, 1)

    heatmap_b64 = None
    if with_gradcam and m.torch_model is not None:
        t2 = time.perf_counter()
        try:
            from .gradcam import cam_to_rgba, compute_cam

            cam = compute_cam(m.torch_model, m.config.backbone, x)
            heatmap_b64 = png_b64(cam_to_rgba(cam))
        except Exception:  # Grad-CAM failure must not hide the grading result
            log.exception("Grad-CAM failed")
        timings["gradcam"] = round((time.perf_counter() - t2) * 1000, 1)

    grading = GradingOut(**decision.to_dict(), tta_scores=[round(v, 4) for v in views])
    images = ImagesOut(display_png_base64=png_b64(prepared.display),
                       processed_png_base64=png_b64(prepared.model_input_uint8),
                       heatmap_png_base64=heatmap_b64)
    timings["total"] = round((time.perf_counter() - t0) * 1000, 1)
    return PredictResponse(quality=q_out, grading=grading, images=images, model=model_info(m), timings_ms=timings)
