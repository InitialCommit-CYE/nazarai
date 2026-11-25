"""Response/request schemas of the ML service."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class QualityIssueOut(BaseModel):
    code: str
    message: str


class QualityOut(BaseModel):
    ok: bool
    issues: list[QualityIssueOut]
    blur_score: float | None = None
    brightness: float | None = None
    green_mean: float | None = None
    saturated_fraction: float | None = None
    fundus_fraction: float | None = None
    circularity: float | None = None
    dark_corners: int | None = None
    red_blue_ratio: float | None = None


class ModelInfo(BaseModel):
    model_version: str
    backbone: str
    image_size: int
    trained: bool = Field(description="False for an untrained pipeline-test artefact. Never true for mock output.")


class GradingOut(BaseModel):
    grade: int = Field(ge=0, le=4)
    grade_label: str
    continuous_score: float
    confidence: float = Field(ge=0, le=1, description="Heuristic, not a calibrated probability")
    referable: bool
    urgency: Literal["routine", "refer", "urgent"]
    borderline: bool
    recommendation_en: str
    decision_reason: str
    tta_scores: list[float]


class ImagesOut(BaseModel):
    display_png_base64: str = Field(description="Cropped, resized original (overlay base)")
    processed_png_base64: str = Field(description="Ben-Graham-processed model input")
    heatmap_png_base64: str | None = Field(None, description="Grad-CAM RGBA heatmap aligned with display")


class PredictResponse(BaseModel):
    quality: QualityOut
    grading: GradingOut | None = None  # None when the quality gate rejects the image
    images: ImagesOut | None = None
    model: ModelInfo
    timings_ms: dict[str, float]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model: ModelInfo | None = None
    gradcam_available: bool
    metrics_available: bool
    app_env: str
    detail: str | None = None


class PdfRequest(BaseModel):
    screening_id: str = Field(min_length=1, max_length=64)
    created_at: str
    demo_patient_code: str | None = Field(None, max_length=40)
    age: int | None = Field(None, ge=0, le=120)
    diabetes_duration_years: int | None = Field(None, ge=0, le=100)
    grade: int = Field(ge=0, le=4)
    grade_label: str = Field(max_length=40)
    confidence: float = Field(ge=0, le=1)
    referable: bool
    urgency: Literal["routine", "refer", "urgent"]
    model_version: str = Field(max_length=80)
    is_development_model: bool = False
    language: Literal["en", "ur"] = "en"
    report_text: str = Field("", max_length=6000)
