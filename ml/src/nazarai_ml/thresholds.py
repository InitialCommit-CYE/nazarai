"""Ordinal-regression thresholds.

* optimise_grade_thresholds: maximise Quadratic Weighted Kappa on the VALIDATION set.
* choose_referral_threshold: pick the continuous-score cut-off for referable DR (grade >= 2)
  that reaches the target sensitivity on the VALIDATION set, maximising specificity.

The external test set (IDRiD) must never be passed to these functions.
"""
from __future__ import annotations

import numpy as np

# scipy / scikit-learn are imported lazily: the inference service only needs apply_thresholds.

DEFAULT_THRESHOLDS = [0.5, 1.5, 2.5, 3.5]


def apply_thresholds(scores: np.ndarray, thresholds: list[float]) -> np.ndarray:
    """Map continuous scores to integer grades 0..4 using sorted cut-points."""
    t = np.sort(np.asarray(thresholds, dtype=np.float64))
    return np.digitize(np.asarray(scores, dtype=np.float64), t).astype(np.int64)


def qwk(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    from sklearn.metrics import cohen_kappa_score

    return float(cohen_kappa_score(y_true, y_pred, weights="quadratic", labels=[0, 1, 2, 3, 4]))


def optimise_grade_thresholds(scores: np.ndarray, y_true: np.ndarray, init: list[float] | None = None) -> list[float]:
    """Nelder-Mead search over the 4 cut-points, from several starts. Returns sorted thresholds."""
    from scipy.optimize import minimize

    scores = np.asarray(scores, dtype=np.float64)
    y_true = np.asarray(y_true, dtype=np.int64)

    def loss(t: np.ndarray) -> float:
        return -qwk(y_true, apply_thresholds(scores, list(t)))

    starts = [init or DEFAULT_THRESHOLDS, [0.7, 1.5, 2.5, 3.3], [0.5, 1.3, 2.3, 3.0]]
    best_t, best_l = np.array(DEFAULT_THRESHOLDS), loss(np.array(DEFAULT_THRESHOLDS))
    for s in starts:
        r = minimize(loss, np.array(s, dtype=np.float64), method="Nelder-Mead", options={"xatol": 1e-3, "maxiter": 2000})
        if r.fun < best_l:
            best_t, best_l = r.x, r.fun
    return [round(float(x), 4) for x in np.sort(best_t)]


def choose_referral_threshold(
    scores: np.ndarray, y_true: np.ndarray, grade_thresholds: list[float], target_sensitivity: float = 0.90
) -> dict:
    """Referral cut-off for the DEPLOYED rule (refer if grade >= 2 or score >= t), on VALIDATION data.

    Picks the highest t (best specificity) whose deployed-rule sensitivity for grade >= 2 reaches the
    target. t is capped at the grade-2 cut-off, since grade >= 2 is always referred.
    """
    scores = np.asarray(scores, dtype=np.float64)
    positive = np.asarray(y_true) >= 2
    if positive.sum() == 0 or (~positive).sum() == 0:
        raise ValueError("validation set needs both referable and non-referable cases")
    g2 = float(sorted(grade_thresholds)[1])
    candidates = np.unique(np.concatenate([scores[scores <= g2], [g2]]))
    best = None
    for t in candidates:
        pred = scores >= min(t, g2)
        sens = float((pred & positive).sum() / positive.sum())
        spec = float((~pred & ~positive).sum() / (~positive).sum())
        if sens >= target_sensitivity and (best is None or spec > best["specificity"]):
            best = {"threshold": round(float(t), 4), "sensitivity": sens, "specificity": spec}
    if best is None:  # even referring every grade >= 1 band misses the target: refer from the lowest score
        t = float(candidates.min())
        pred = scores >= t
        best = {"threshold": round(t, 4), "sensitivity": float((pred & positive).sum() / positive.sum()),
                "specificity": float((~pred & ~positive).sum() / (~positive).sum())}
    best["target_sensitivity"] = target_sensitivity
    best["grade2_cutoff"] = round(g2, 4)
    return best
