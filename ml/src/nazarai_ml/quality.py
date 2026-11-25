"""Heuristic image-quality gate (CLAUDE.md section 4.1). Runs BEFORE grading.

A rejected image is never graded. Thresholds are configurable through QualityConfig (and,
in the backend, through environment variables) and were chosen to be conservative:
when in doubt, ask for a retake.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import cv2
import numpy as np

from .preprocess import BORDER_TOLERANCE

ANALYSIS_SIZE = 512  # images are rescaled so the blur score is resolution independent


@dataclass(frozen=True)
class QualityConfig:
    min_side_px: int = 224
    max_aspect_ratio: float = 2.0
    # Variance of the Laplacian of the green channel inside the fundus, at 512px.
    blur_threshold: float = 12.0
    # Mean grey level inside the fundus area.
    min_brightness: float = 30.0
    max_brightness: float = 200.0
    # Overexposure is judged on the green channel (red clips even in good photos).
    # Measured on IDRiD: real photos have green mean 27-108 and ~0% clipping; 3x exposure
    # pushes the median to 184 and 30% clipping.
    max_green_mean: float = 150.0
    max_saturated_fraction: float = 0.08
    # Fundus area as a fraction of the image.
    min_fundus_fraction: float = 0.20
    # Fundus area / area of its minimum enclosing circle (1.0 = perfect disc).
    min_circularity: float = 0.65  # IDRiD real photos: 0.86-0.89; cut-off circles (EyePACS) ~0.7-0.8
    # At least this many of the four corners must be dark camera border.
    min_dark_corners: int = 2
    # Retinas are red/orange: mean(R) must exceed mean(B) by this factor.
    min_red_blue_ratio: float = 1.6  # IDRiD real photos: >= 2.1


@dataclass
class QualityIssue:
    code: str
    message: str


@dataclass
class QualityResult:
    ok: bool
    issues: list[QualityIssue] = field(default_factory=list)
    blur_score: float | None = None
    brightness: float | None = None
    saturated_fraction: float | None = None
    green_mean: float | None = None
    fundus_fraction: float | None = None
    circularity: float | None = None
    dark_corners: int | None = None
    red_blue_ratio: float | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["issues"] = [asdict(i) for i in self.issues]
        return d


def _rescale(img: np.ndarray, target: int = ANALYSIS_SIZE) -> np.ndarray:
    h, w = img.shape[:2]
    scale = target / max(h, w)
    return cv2.resize(img, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)


def _largest_component(mask: np.ndarray) -> np.ndarray:
    m = mask.astype(np.uint8)
    # Close small gaps (dark vessels / lesions near the rim) before picking the component.
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return np.zeros_like(mask, dtype=bool)
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    comp = (labels == idx).astype(np.uint8)
    # Fill interior holes.
    contours, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(comp)
    cv2.drawContours(filled, contours, -1, 1, thickness=-1)
    return filled.astype(bool)


def assess_quality(img_rgb: np.ndarray, cfg: QualityConfig | None = None) -> QualityResult:
    """Return a QualityResult. ok=False means: do not grade, ask for a retake."""
    cfg = cfg or QualityConfig()
    res = QualityResult(ok=True)

    if img_rgb is None or img_rgb.ndim != 3 or img_rgb.shape[2] != 3:
        res.ok = False
        res.issues.append(QualityIssue("invalid_image", "The file is not a valid colour image."))
        return res

    h, w = img_rgb.shape[:2]
    if min(h, w) < cfg.min_side_px:
        res.ok = False
        res.issues.append(QualityIssue("too_small", f"Image resolution is too low ({w}x{h}px)."))
        return res
    if max(h, w) / min(h, w) > cfg.max_aspect_ratio:
        res.ok = False
        res.issues.append(QualityIssue("not_retina", "Image shape does not match a fundus photograph."))
        return res

    img = _rescale(img_rgb)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    mask = _largest_component(gray > BORDER_TOLERANCE)
    area = int(mask.sum())
    res.fundus_fraction = round(area / mask.size, 4)

    # --- Is it a retina? -------------------------------------------------------------
    is_retina = True
    if area > 0:
        pts = cv2.findNonZero(mask.astype(np.uint8))
        (_, _), radius = cv2.minEnclosingCircle(pts)
        res.circularity = round(float(area / (np.pi * radius * radius + 1e-6)), 4)
    else:
        res.circularity = 0.0

    ch, cw = gray.shape
    k = max(4, int(min(ch, cw) * 0.06))
    corners = [gray[:k, :k], gray[:k, -k:], gray[-k:, :k], gray[-k:, -k:]]
    res.dark_corners = int(sum(float(c.mean()) < BORDER_TOLERANCE * 2.5 for c in corners))

    if area > 0:
        r_mean = float(img[..., 0][mask].mean())
        b_mean = float(img[..., 2][mask].mean())
        res.red_blue_ratio = round(r_mean / (b_mean + 1.0), 3)
    else:
        res.red_blue_ratio = 0.0

    if (
        res.fundus_fraction < cfg.min_fundus_fraction
        or res.circularity < cfg.min_circularity
        or res.dark_corners < cfg.min_dark_corners
        or res.red_blue_ratio < cfg.min_red_blue_ratio
    ):
        is_retina = False
        res.ok = False
        res.issues.append(
            QualityIssue(
                "not_retina",
                "This does not look like a retinal (fundus) photograph. Capture the retina centred, "
                "with the circular field of view visible.",
            )
        )

    if area == 0:
        return res

    # --- Exposure -------------------------------------------------------------------
    fundus_pixels = gray[mask]
    res.brightness = round(float(fundus_pixels.mean()), 2)
    green_pixels = img[..., 1][mask]
    res.green_mean = round(float(green_pixels.mean()), 2)
    res.saturated_fraction = round(float((green_pixels >= 245).mean()), 4)
    if res.brightness < cfg.min_brightness:
        res.ok = False
        res.issues.append(QualityIssue("too_dark", "The image is too dark. Increase illumination and retake."))
    elif (
        res.brightness > cfg.max_brightness
        or res.green_mean > cfg.max_green_mean
        or res.saturated_fraction > cfg.max_saturated_fraction
    ):
        res.ok = False
        res.issues.append(QualityIssue("overexposed", "The image is overexposed. Reduce flash/illumination and retake."))

    # --- Blur (only meaningful for a fundus image) ----------------------------------
    green = img[..., 1]
    lap = cv2.Laplacian(green, cv2.CV_64F)
    # Erode the mask so the sharp fundus rim does not count as "detail".
    inner = cv2.erode(mask.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
    res.blur_score = round(float(lap[inner].var()) if inner.any() else 0.0, 2)
    if is_retina and res.blur_score < cfg.blur_threshold:
        res.ok = False
        res.issues.append(QualityIssue("blurry", "The image is blurry. Hold the camera steady, refocus and retake."))

    return res
