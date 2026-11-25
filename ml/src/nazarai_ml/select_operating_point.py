"""Re-select the referral operating point of an existing run from its VALIDATION predictions.

    python -m nazarai_ml.select_operating_point --run ./run --target-sensitivity 0.90

Uses run/val_predictions.csv (written by train.py) only, so no retraining and no test data are
involved. Grade thresholds are kept; the referral threshold is chosen for the deployed rule
(refer if grade >= 2 or score >= t). Prints the validation trade-off table for the record.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .thresholds import choose_referral_threshold


def tradeoff(scores: np.ndarray, y: np.ndarray, g2: float, targets=(0.80, 0.85, 0.87, 0.90, 0.95)) -> list[dict]:
    pos = y >= 2
    rows = []
    for t in sorted(set([round(float(x), 2) for x in np.arange(0.0, g2 + 1e-9, 0.1)] + [g2])):
        pred = scores >= t
        rows.append({"threshold": t, "sensitivity": round(float((pred & pos).sum() / pos.sum()), 4),
                     "specificity": round(float((~pred & ~pos).sum() / (~pos).sum()), 4)})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--target-sensitivity", type=float, default=0.90)
    args = ap.parse_args()

    run = Path(args.run)
    cfg = json.loads((run / "model_config.json").read_text())
    vp = pd.read_csv(run / "val_predictions.csv")
    scores, y = vp["score"].to_numpy(), vp["grade"].to_numpy()
    g2 = sorted(cfg["grade_thresholds"])[1]
    print(pd.DataFrame(tradeoff(scores, y, g2)).to_string(index=False))
    sel = choose_referral_threshold(scores, y, cfg["grade_thresholds"], args.target_sensitivity)
    print("selected:", sel)

    cfg.setdefault("history", []).append({"referral_threshold": cfg["referral_threshold"],
                                          "referral_selection": cfg.get("referral_selection"),
                                          "replaced_at": datetime.now(timezone.utc).isoformat()})
    cfg["referral_threshold"] = sel["threshold"]
    cfg["referral_selection"] = sel
    cfg["decision_rule"] = "v2: refer if grade >= 2 or score >= referral_threshold (validation-selected)"
    (run / "model_config.json").write_text(json.dumps(cfg, indent=2))
    print("updated", run / "model_config.json")


if __name__ == "__main__":
    main()
