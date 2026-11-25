"""Loads model artefacts (downloading them from the Hugging Face Hub if configured).

Artefacts (written by ml/src/nazarai_ml/train.py + export_onnx.py):
    model.onnx         graded with onnxruntime on CPU
    model.pt           PyTorch weights, used only for Grad-CAM
    model_config.json  backbone, image size, thresholds, version, "trained": true

There is deliberately NO random/mock fallback: if the artefacts are missing the service reports
model_loaded=false and /predict returns 503. An untrained pipeline-test artefact (trained=false)
is refused in production.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from nazarai_ml.scorer import ModelConfig, OnnxScorer

from .config import Settings

log = logging.getLogger("nazarai.model")
ARTEFACTS = ("model_config.json", "model.onnx", "model.pt")


@dataclass
class LoadedModel:
    config: ModelConfig
    scorer: OnnxScorer
    torch_model: object | None  # torch.nn.Module, loaded lazily for Grad-CAM
    trained: bool


class ModelStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model: LoadedModel | None = None
        self.error: str | None = None

    def _download(self) -> None:
        from huggingface_hub import hf_hub_download

        self.settings.model_dir.mkdir(parents=True, exist_ok=True)
        for name in ARTEFACTS:
            target = self.settings.model_dir / name
            if target.exists():
                continue
            log.info("downloading %s from %s", name, self.settings.hf_model_repo)
            hf_hub_download(
                repo_id=self.settings.hf_model_repo,
                filename=name,
                revision=self.settings.hf_model_revision,
                token=self.settings.hf_token or None,
                local_dir=str(self.settings.model_dir),
            )

    def load(self) -> None:
        try:
            if self.settings.hf_model_repo:
                self._download()
            d: Path = self.settings.model_dir
            missing = [n for n in ARTEFACTS[:2] if not (d / n).exists()]
            if missing:
                raise FileNotFoundError(f"model artefacts missing in {d}: {missing}")
            cfg = ModelConfig.load(d / "model_config.json")
            trained = bool(cfg.raw.get("trained", False))
            if self.settings.is_production and not trained:
                raise RuntimeError("refusing to serve an untrained (pipeline-test) model in production")
            scorer = OnnxScorer(d / "model.onnx", cfg, threads=self.settings.onnx_threads)
            torch_model = None
            if self.settings.enable_gradcam and (d / "model.pt").exists():
                from nazarai_ml.model import load_checkpoint

                torch_model = load_checkpoint(str(d / "model.pt"), cfg.backbone)
            self.model = LoadedModel(cfg, scorer, torch_model, trained)
            self.error = None
            log.info("model %s loaded (trained=%s, gradcam=%s)", cfg.model_version, trained, torch_model is not None)
        except Exception as exc:  # report, never fall back to fake predictions
            self.model = None
            self.error = f"{type(exc).__name__}: {exc}"
            log.error("model not loaded: %s", self.error)
