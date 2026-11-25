"""Deploy the FastAPI ML service to a Hugging Face Space (Docker SDK).

    backend/.venv/Scripts/python scripts/deploy_hf_space.py --space <user-or-org>/nazarai-ml

Uploads only what the image needs (Dockerfile, backend/app, backend/requirements.txt, ml/src,
ml/reports). Model weights are NOT uploaded here: the Space downloads them at startup from the
private model repo named in the HF_MODEL_REPO Space secret (see scripts/upload_model.py).

Space secrets/variables to set in the Space settings:
    ML_SERVICE_API_KEY  (secret)  shared with the Vercel app
    HF_MODEL_REPO       (variable) e.g. <user>/nazarai-dr-model
    HF_TOKEN            (secret)  read token, only if the model repo is private
"""
from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]

SPACE_README = """---
title: NazarAI ML Service
emoji: 👁️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Diabetic retinopathy screening inference API (NazarAI)
---

NazarAI ML inference service: image quality gate, DR grading (ONNX Runtime), Grad-CAM and PDF
referral slips. Called server-to-server by the NazarAI web app; all endpoints except `/health`
require the `X-API-Key` header. Screening support only, not a diagnosis.
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", required=True, help="e.g. your-name/nazarai-ml")
    ap.add_argument("--private", action="store_true")
    args = ap.parse_args()

    api = HfApi()
    api.create_repo(args.space, repo_type="space", space_sdk="docker", private=args.private, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        shutil.copy(ROOT / "backend" / "Dockerfile", t / "Dockerfile")
        (t / "README.md").write_text(SPACE_README, encoding="utf-8")
        shutil.copytree(ROOT / "backend" / "app", t / "backend" / "app", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copy(ROOT / "backend" / "requirements.txt", t / "backend" / "requirements.txt")
        shutil.copytree(ROOT / "ml" / "src", t / "ml" / "src", ignore=shutil.ignore_patterns("__pycache__"))
        (t / "ml" / "reports").mkdir(parents=True)
        for f in (ROOT / "ml" / "reports").glob("*"):
            if f.is_file():
                shutil.copy(f, t / "ml" / "reports" / f.name)
        api.upload_folder(folder_path=str(t), repo_id=args.space, repo_type="space",
                          commit_message="Deploy NazarAI ML service")
    print(f"Deployed. Space: https://huggingface.co/spaces/{args.space}")
    print(f"API base URL (set as ML_SERVICE_URL on Vercel): https://{args.space.replace('/', '-').lower()}.hf.space")


if __name__ == "__main__":
    main()
