"""Service configuration from environment variables (never hard-code secrets)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"  # development | production
    # Shared secret the Next.js server sends in X-API-Key. Required in production.
    ml_service_api_key: str = ""

    # Model artefacts: model.onnx, model.pt, model_config.json
    model_dir: Path = REPO_ROOT / "ml" / "weights"
    hf_model_repo: str = ""  # e.g. "your-org/nazarai-dr-model"; artefacts downloaded at startup
    hf_model_revision: str = "main"
    hf_token: str = ""

    metrics_path: Path = REPO_ROOT / "ml" / "reports" / "metrics.json"

    max_upload_mb: float = 10.0
    onnx_threads: int = 0
    enable_gradcam: bool = True

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
