"""Evaluation metrics computed with the deployed decision rule (decision.decide)."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve

from .decision import DecisionConfig, decide
from .thresholds import apply_thresholds, qwk


def _safe_div(a: float, b: float) -> float | None:
    return round(a / b, 4) if b else None


def split_metrics(name: str, y_true: np.ndarray, scores: np.ndarray, tta_views: np.ndarray, cfg: DecisionConfig,
                  description: str = "") -> dict:
    """y_true: (N,) grades; scores: (N,) mean TTA score; tta_views: (N, V) per-view scores."""
    y_true = np.asarray(y_true, dtype=np.int64)
    grades = apply_thresholds(scores, list(cfg.grade_thresholds))
    decisions = [decide(float(s), list(v), cfg) for s, v in zip(scores, tta_views)]
    referred = np.array([d.referable for d in decisions])
    positive = y_true >= 2

    tp = int((referred & positive).sum())
    fp = int((referred & ~positive).sum())
    tn = int((~referred & ~positive).sum())
    fn = int((~referred & positive).sum())

    roc = None
    auc = None
    if positive.any() and (~positive).any():
        auc = round(float(roc_auc_score(positive, scores)), 4)
        fpr, tpr, thr = roc_curve(positive, scores)
        # Downsample to <= 150 points for the frontend.
        idx = np.unique(np.linspace(0, len(fpr) - 1, min(150, len(fpr))).astype(int))
        roc = {
            "fpr": [round(float(x), 4) for x in fpr[idx]],
            "tpr": [round(float(x), 4) for x in tpr[idx]],
            "operating_point": {"fpr": _safe_div(fp, fp + tn), "tpr": _safe_div(tp, tp + fn),
                                "threshold": cfg.referral_threshold},
        }

    cm = confusion_matrix(y_true, grades, labels=[0, 1, 2, 3, 4])
    per_grade = []
    for g in range(5):
        support = int(cm[g].sum())
        predicted = int(cm[:, g].sum())
        per_grade.append({
            "grade": g,
            "support": support,
            "recall": _safe_div(int(cm[g, g]), support),
            "precision": _safe_div(int(cm[g, g]), predicted),
        })

    return {
        "name": name,
        "description": description,
        "n_images": int(len(y_true)),
        "grade_distribution": np.bincount(y_true, minlength=5).tolist(),
        "qwk": round(qwk(y_true, grades), 4),
        "accuracy": round(float((grades == y_true).mean()), 4),
        "referable": {
            "definition": "grade >= 2 (moderate NPDR or worse); prediction uses the deployed referral rule",
            "sensitivity": _safe_div(tp, tp + fn),
            "specificity": _safe_div(tn, tn + fp),
            "ppv": _safe_div(tp, tp + fp),
            "npv": _safe_div(tn, tn + fn),
            "auc": auc,
            "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        },
        "confusion_matrix": cm.tolist(),
        "per_grade": per_grade,
        "roc": roc,
    }
