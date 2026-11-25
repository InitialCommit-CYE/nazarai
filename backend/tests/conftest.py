import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml" / "src"))

DEMO = ROOT / "demo_images"
DEV_WEIGHTS = ROOT / "ml" / "weights-dev"


@pytest.fixture(scope="session")
def demo_bytes():
    def _read(name: str) -> bytes:
        return (DEMO / name).read_bytes()

    return _read


@pytest.fixture(scope="session")
def client():
    """API client backed by the UNTRAINED pipeline-test artefact (scripts/make_pipeline_test_model.py)."""
    if not (DEV_WEIGHTS / "model.onnx").exists():
        pytest.skip("run scripts/make_pipeline_test_model.py first")
    os.environ["MODEL_DIR"] = str(DEV_WEIGHTS)
    os.environ["APP_ENV"] = "development"
    os.environ["ML_SERVICE_API_KEY"] = "test-key"
    os.environ["HF_MODEL_REPO"] = ""
    from app.config import get_settings

    get_settings.cache_clear()
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c
