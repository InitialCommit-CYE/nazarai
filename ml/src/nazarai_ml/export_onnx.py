"""Export the trained checkpoint to ONNX and verify parity with PyTorch (CLAUDE.md section 4.6).

    python -m nazarai_ml.export_onnx --run /kaggle/working/run1
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .model import load_checkpoint


def export(run_dir: str, opset: int = 17) -> Path:
    run = Path(run_dir)
    cfg = json.loads((run / "model_config.json").read_text())
    model = load_checkpoint(str(run / "model.pt"), cfg["backbone"])
    size = cfg["image_size"]
    dummy = torch.randn(4, 3, size, size)
    onnx_path = run / "model.onnx"
    torch.onnx.export(
        model, dummy, str(onnx_path), input_names=["input"], output_names=["score"],
        dynamic_axes={"input": {0: "batch"}, "score": {0: "batch"}}, opset_version=opset, dynamo=False,
    )

    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    x = torch.randn(4, 3, size, size)
    with torch.no_grad():
        ref = model(x).numpy().reshape(-1)
    got = sess.run(None, {"input": x.numpy()})[0].reshape(-1)
    max_diff = float(np.abs(ref - got).max())
    print(f"ONNX parity max |diff| = {max_diff:.2e}")
    if max_diff > 1e-3:
        raise SystemExit("ONNX output does not match PyTorch; do not deploy this export")
    return onnx_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--opset", type=int, default=17)
    export(**{"run_dir": ap.parse_args().run, "opset": ap.parse_args().opset})
