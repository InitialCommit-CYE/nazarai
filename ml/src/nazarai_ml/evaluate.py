"""Evaluate the exported model and write ml/reports/metrics.json + plots (CLAUDE.md section 4.4).

    python -m nazarai_ml.evaluate --run /kaggle/working/run1 \
        --manifests /kaggle/working/manifests --reports /kaggle/working/reports

Validation = held-out patient-level split of the training sources (used for thresholds).
External test = IDRiD, never used for training or threshold tuning.
Honesty rule: these numbers are reported as-is, even if below the IDx-DR benchmark.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .metrics import split_metrics
from .preprocess import read_image
from .scorer import ModelConfig, OnnxScorer

IDX_DR = {
    "name": "IDx-DR (LumineticsCore)",
    "sensitivity": 0.87,
    "specificity": 0.90,
    "definition": "more-than-mild DR, 900-patient pivotal trial (FDA De Novo, April 2018)",
    "sources": [
        "https://www.aao.org/headline/first-ai-screen-diabetic-retinopathy-approved-by-f",
        "https://chiefhealthcareexecutive.com/view/the-numbers-behind-the-first-fdaapproved-autonomous-ai-diagnostic-system",
    ],
    "note": "Different population, cameras and reference standard; a side-by-side reference, not a head-to-head trial.",
}


def score_manifest(scorer: OnnxScorer, df: pd.DataFrame, timings: list[float] | None = None):
    means, views = [], []
    for i, path in enumerate(df.path):
        t0 = time.perf_counter()
        m, v, _, _ = scorer.score(read_image(path))
        if timings is not None:
            timings.append((time.perf_counter() - t0) * 1000)
        means.append(m)
        views.append(v)
        if i % 200 == 0:
            print(f"  {i}/{len(df)}", flush=True)
    return np.array(means), np.array(views)


def plot_confusion(cm: list[list[int]], title: str, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(5, 4.5))
    arr = np.array(cm)
    ax.imshow(arr, cmap="Blues")
    for i in range(5):
        for j in range(5):
            ax.text(j, i, str(arr[i, j]), ha="center", va="center", color="white" if arr[i, j] > arr.max() / 2 else "black")
    ax.set_xlabel("Predicted grade")
    ax.set_ylabel("Reference grade")
    ax.set_xticks(range(5))
    ax.set_yticks(range(5))
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def plot_roc(splits: list[dict], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(5, 5))
    for s in splits:
        if s["roc"]:
            ax.plot(s["roc"]["fpr"], s["roc"]["tpr"], label=f"{s['name']} (AUC {s['referable']['auc']:.3f})")
            op = s["roc"]["operating_point"]
            ax.scatter([op["fpr"]], [op["tpr"]], zorder=5)
    ax.scatter([1 - IDX_DR["specificity"]], [IDX_DR["sensitivity"]], marker="x", color="black", label="IDx-DR (reported)")
    ax.plot([0, 1], [0, 1], "--", color="grey", linewidth=0.8)
    ax.set_xlabel("1 - specificity")
    ax.set_ylabel("Sensitivity")
    ax.set_title("Referable DR (grade >= 2)")
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, help="dir with model.onnx + model_config.json")
    ap.add_argument("--manifests", required=True)
    ap.add_argument("--reports", required=True)
    ap.add_argument("--threads", type=int, default=0)
    args = ap.parse_args()

    run, reports = Path(args.run), Path(args.reports)
    reports.mkdir(parents=True, exist_ok=True)
    cfg = ModelConfig.load(run / "model_config.json")
    scorer = OnnxScorer(run / "model.onnx", cfg, threads=args.threads)
    dcfg = cfg.decision_config()

    splits = {}
    timings: list[float] = []
    val_df = pd.read_csv(Path(args.manifests) / "val.csv")
    print("scoring validation", len(val_df))
    s, v = score_manifest(scorer, val_df)
    splits["validation"] = split_metrics(
        "Validation", val_df.grade.to_numpy(), s, v, dcfg,
        f"Patient-level held-out split of {', '.join(sorted(val_df.source.unique()))}; used to fit thresholds.")

    test_path = Path(args.manifests) / "test_idrid.csv"
    if test_path.exists():
        test_df = pd.read_csv(test_path)
        print("scoring external test", len(test_df))
        s, v = score_manifest(scorer, test_df, timings)
        splits["external_test"] = split_metrics(
            "External test (IDRiD)", test_df.grade.to_numpy(), s, v, dcfg,
            "IDRiD disease-grading set (India). Never used for training or threshold tuning.")

    for key, sm in splits.items():
        plot_confusion(sm["confusion_matrix"], sm["name"], reports / f"confusion_matrix_{key}.png")
    plot_roc(list(splits.values()), reports / "roc.png")

    import platform
    import onnxruntime

    metrics = {
        "status": "complete",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "model_version": cfg.model_version,
            "backbone": cfg.backbone,
            "pretrained_weights": f"timm {cfg.backbone} ImageNet",
            "image_size": cfg.image_size,
            "grade_thresholds": cfg.grade_thresholds,
            "referral_threshold": cfg.referral_threshold,
            "referral_selection": cfg.raw.get("referral_selection"),
            "train_sources": cfg.raw.get("train_sources"),
            "n_train": cfg.raw.get("n_train"),
        },
        "splits": splits,
        "inference": {
            "measured_on": "external_test" if timings else None,
            "n": len(timings),
            "mean_ms": round(float(np.mean(timings)), 1) if timings else None,
            "p95_ms": round(float(np.percentile(timings, 95)), 1) if timings else None,
            "includes": "decode + preprocessing + 4-view TTA ONNX inference (no Grad-CAM)",
            "device": f"CPU ({platform.processor() or platform.machine()}), onnxruntime {onnxruntime.__version__}",
        },
        "benchmark": IDX_DR,
    }
    (reports / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps({k: {"qwk": v["qwk"], **{m: v["referable"][m] for m in ("sensitivity", "specificity", "auc")}}
                      for k, v in splits.items()}, indent=2))


if __name__ == "__main__":
    main()
