"""Create an UNTRAINED pipeline-test model artefact for local development and CI.

    backend/.venv/Scripts/python scripts/make_pipeline_test_model.py --out ml/weights-dev

It has random weights and model_config.json "trained": false. Its predictions are meaningless.
It exists only to exercise the real code path (ONNX grading + Grad-CAM) before the trained model
is available. The backend refuses to load it when APP_ENV=production, and every response made
with it carries model.trained=false so the UI shows a "development model" warning.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ml" / "src"))
from nazarai_ml.model import build_model  # noqa: E402
from nazarai_ml.thresholds import DEFAULT_THRESHOLDS  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ml/weights-dev")
    ap.add_argument("--backbone", default="efficientnet_b3")
    ap.add_argument("--size", type=int, default=384)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(0)
    model = build_model(args.backbone, pretrained=False).eval()
    torch.save(model.state_dict(), out / "model.pt")
    torch.onnx.export(model, torch.randn(1, 3, args.size, args.size), str(out / "model.onnx"),
                      input_names=["input"], output_names=["score"],
                      dynamic_axes={"input": {0: "batch"}, "score": {0: "batch"}}, opset_version=17, dynamo=False)
    (out / "model_config.json").write_text(json.dumps({
        "model_version": "UNTRAINED-PIPELINE-TEST",
        "trained": False,
        "backbone": args.backbone,
        "image_size": args.size,
        "grade_thresholds": DEFAULT_THRESHOLDS,
        "referral_threshold": 1.5,
        "note": "Random weights. For pipeline testing only. Never deploy. Predictions are meaningless.",
    }, indent=2))
    print(f"wrote untrained pipeline-test artefact to {out}")


if __name__ == "__main__":
    main()
