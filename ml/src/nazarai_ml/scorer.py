"""ONNX Runtime scorer shared by evaluate.py and the backend, so evaluated == served inference."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .decision import DecisionConfig
from .preprocess import PreparedFundus, preprocess_for_model


@dataclass
class ModelConfig:
    model_version: str
    backbone: str
    image_size: int
    grade_thresholds: list[float]
    referral_threshold: float
    raw: dict

    @classmethod
    def load(cls, path: str | Path) -> "ModelConfig":
        raw = json.loads(Path(path).read_text())
        return cls(raw["model_version"], raw["backbone"], int(raw["image_size"]),
                   [float(t) for t in raw["grade_thresholds"]], float(raw["referral_threshold"]), raw)

    def decision_config(self) -> DecisionConfig:
        return DecisionConfig(tuple(self.grade_thresholds), self.referral_threshold)


def tta_batch(x_chw: np.ndarray) -> np.ndarray:
    """Original, h-flip, v-flip, both. Mirrors model.predict_tta."""
    return np.stack([x_chw, x_chw[:, :, ::-1], x_chw[:, ::-1, :], x_chw[:, ::-1, ::-1]]).astype(np.float32)


class OnnxScorer:
    def __init__(self, onnx_path: str | Path, config: ModelConfig, threads: int = 0):
        import onnxruntime as ort

        opts = ort.SessionOptions()
        if threads:
            opts.intra_op_num_threads = threads
        self.session = ort.InferenceSession(str(onnx_path), sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.config = config

    def score(self, img_rgb: np.ndarray) -> tuple[float, list[float], PreparedFundus, np.ndarray]:
        """Returns (mean score, per-view scores, prepared images, normalised CHW tensor)."""
        x, prepared = preprocess_for_model(img_rgb, self.config.image_size)
        views = self.session.run(None, {self.input_name: np.ascontiguousarray(tta_batch(x))})[0].reshape(-1)
        views_l = [float(v) for v in views]
        return float(np.mean(views_l)), views_l, prepared, x
