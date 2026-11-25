"""Upload trained model artefacts to a (private) Hugging Face model repo.

    backend/.venv/Scripts/python scripts/upload_model.py --run ./run1 --repo <user>/nazarai-dr-model

Refuses untrained pipeline-test artefacts. The ML service downloads model.onnx, model.pt and
model_config.json from this repo at startup (HF_MODEL_REPO), so large weights never enter git.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from huggingface_hub import HfApi

FILES = ("model.onnx", "model.pt", "model_config.json")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, help="directory with model.onnx, model.pt, model_config.json")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--public", action="store_true")
    args = ap.parse_args()

    run = Path(args.run)
    missing = [f for f in FILES if not (run / f).exists()]
    if missing:
        raise SystemExit(f"missing artefacts: {missing}")
    cfg = json.loads((run / "model_config.json").read_text())
    if not cfg.get("trained"):
        raise SystemExit("model_config.json is not marked trained=true; refusing to publish")

    api = HfApi()
    api.create_repo(args.repo, repo_type="model", private=not args.public, exist_ok=True)
    for f in FILES:
        print("uploading", f)
        api.upload_file(path_or_fileobj=str(run / f), path_in_repo=f, repo_id=args.repo, repo_type="model",
                        commit_message=f"Upload {f} ({cfg['model_version']})")
    print(f"Done. Set HF_MODEL_REPO={args.repo} on the ML service.")


if __name__ == "__main__":
    main()
