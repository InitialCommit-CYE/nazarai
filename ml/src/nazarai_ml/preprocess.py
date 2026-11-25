"""Shared fundus preprocessing used by BOTH training and inference.

Never re-implement any of these steps elsewhere: a train/inference mismatch silently
destroys accuracy (CLAUDE.md section 12). The backend imports this module directly.

Pipeline (CLAUDE.md section 4.2):
    1. crop the black border around the circular fundus
    2. pad to square and resize (default 384x384)
    3. Ben Graham local-average subtraction, then a circular mask
    4. ImageNet mean/std normalisation
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

DEFAULT_IMAGE_SIZE = 384
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Pixels darker than this (0-255 grey) are treated as the black camera border.
BORDER_TOLERANCE = 10
# Fraction of the image radius kept by the circular mask.
MASK_RADIUS_FRACTION = 0.96


class ImageDecodeError(ValueError):
    """Raised when bytes cannot be decoded into an image."""


def decode_image(data: bytes) -> np.ndarray:
    """Decode encoded image bytes (JPEG/PNG/WebP) to an RGB uint8 array."""
    if not data:
        raise ImageDecodeError("empty image payload")
    buf = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ImageDecodeError("file is not a decodable image")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def read_image(path: str) -> np.ndarray:
    """Read an image file from disk as RGB uint8."""
    with open(path, "rb") as fh:
        return decode_image(fh.read())


def fundus_mask(img_rgb: np.ndarray, tol: int = BORDER_TOLERANCE) -> np.ndarray:
    """Boolean mask of pixels that belong to the (non-black) fundus area."""
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    return gray > tol


def crop_black_border(img_rgb: np.ndarray, tol: int = BORDER_TOLERANCE) -> np.ndarray:
    """Crop to the bounding box of non-black pixels. Returns the input if nothing is found."""
    mask = fundus_mask(img_rgb, tol)
    if not mask.any():
        return img_rgb
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    cropped = img_rgb[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]
    # Guard against a few stray bright pixels producing a degenerate crop.
    if cropped.shape[0] < 32 or cropped.shape[1] < 32:
        return img_rgb
    return cropped


def pad_to_square(img_rgb: np.ndarray) -> np.ndarray:
    """Centre the image on a black square canvas so the fundus circle is not distorted."""
    h, w = img_rgb.shape[:2]
    side = max(h, w)
    canvas = np.zeros((side, side, 3), dtype=img_rgb.dtype)
    top = (side - h) // 2
    left = (side - w) // 2
    canvas[top : top + h, left : left + w] = img_rgb
    return canvas


def circular_mask(size: int, radius_fraction: float = MASK_RADIUS_FRACTION) -> np.ndarray:
    """uint8 {0,1} mask of a centred circle."""
    mask = np.zeros((size, size), dtype=np.uint8)
    cv2.circle(mask, (size // 2, size // 2), int(size / 2 * radius_fraction), 1, thickness=-1)
    return mask


def ben_graham(img_rgb: np.ndarray, sigma: float | None = None) -> np.ndarray:
    """Ben Graham (Kaggle DR 2015 winner): 4*img - 4*GaussianBlur(img) + 128, then circle mask."""
    size = img_rgb.shape[0]
    if sigma is None:
        sigma = size / 30.0
    blurred = cv2.GaussianBlur(img_rgb, (0, 0), sigma)
    out = cv2.addWeighted(img_rgb, 4.0, blurred, -4.0, 128.0)
    mask = circular_mask(size)
    return (out * mask[..., None]).astype(np.uint8)


@dataclass(frozen=True)
class PreparedFundus:
    """Outputs of the shared preparation step.

    display: cropped + squared + resized RGB image (what the clinician recognises; used for
             the Grad-CAM overlay so the heatmap aligns pixel-for-pixel).
    model_input_uint8: Ben-Graham-processed RGB image, before normalisation. Training
             augmentations are applied to this array.
    """

    display: np.ndarray
    model_input_uint8: np.ndarray


def prepare_fundus(img_rgb: np.ndarray, size: int = DEFAULT_IMAGE_SIZE) -> PreparedFundus:
    """Steps 1-3 of the pipeline. Input: RGB uint8 of any size."""
    if img_rgb.ndim != 3 or img_rgb.shape[2] != 3:
        raise ValueError("expected an RGB image with 3 channels")
    cropped = crop_black_border(img_rgb)
    squared = pad_to_square(cropped)
    interp = cv2.INTER_AREA if squared.shape[0] > size else cv2.INTER_CUBIC
    display = cv2.resize(squared, (size, size), interpolation=interp)
    display = (display * circular_mask(size)[..., None]).astype(np.uint8)
    processed = ben_graham(display)
    return PreparedFundus(display=display, model_input_uint8=processed)


def normalize(img_uint8: np.ndarray) -> np.ndarray:
    """Step 4: ImageNet normalisation. Returns float32 CHW."""
    x = img_uint8.astype(np.float32) / 255.0
    x = (x - IMAGENET_MEAN) / IMAGENET_STD
    return np.ascontiguousarray(x.transpose(2, 0, 1))


def preprocess_for_model(img_rgb: np.ndarray, size: int = DEFAULT_IMAGE_SIZE) -> tuple[np.ndarray, PreparedFundus]:
    """Full inference pipeline: returns (float32 CHW tensor, PreparedFundus)."""
    prepared = prepare_fundus(img_rgb, size)
    return normalize(prepared.model_input_uint8), prepared
