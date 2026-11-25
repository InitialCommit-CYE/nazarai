"""Grad-CAM for the regression model (pytorch-grad-cam).

The target is the scalar severity score, so the heatmap shows regions that INCREASE the
predicted DR grade. It is an explanation aid, not proof that the model is clinically correct.
"""
from __future__ import annotations

import threading

import cv2
import numpy as np
import torch
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

from nazarai_ml.model import gradcam_target_layer
from nazarai_ml.preprocess import circular_mask

_lock = threading.Lock()  # GradCAM registers hooks on the shared model; serialise access


def compute_cam(model: torch.nn.Module, backbone: str, x_chw: np.ndarray) -> np.ndarray:
    """Returns a (H, W) float32 map in [0, 1] aligned with the model input."""
    inp = torch.from_numpy(np.ascontiguousarray(x_chw))[None]
    with _lock:
        with GradCAM(model=model, target_layers=[gradcam_target_layer(model, backbone)]) as cam:
            grayscale = cam(input_tensor=inp, targets=[ClassifierOutputTarget(0)])[0]
    size = x_chw.shape[1]
    grayscale = grayscale * circular_mask(size).astype(np.float32)
    peak = float(grayscale.max())
    return (grayscale / peak).astype(np.float32) if peak > 0 else grayscale.astype(np.float32)


def cam_to_rgba(cam: np.ndarray) -> np.ndarray:
    """Jet-coloured RGBA heatmap; alpha follows activation so cold areas stay see-through."""
    u8 = np.uint8(np.clip(cam, 0, 1) * 255)
    rgb = cv2.cvtColor(cv2.applyColorMap(u8, cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    alpha = np.uint8(np.clip(cam * 1.4, 0, 1) * 235)
    return np.dstack([rgb, alpha])
