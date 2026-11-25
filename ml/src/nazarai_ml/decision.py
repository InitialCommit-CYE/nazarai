"""Turns a continuous model score into the screening decision shown to users.

Shared by evaluation and the backend so the deployed rule is exactly the evaluated rule.

Safety rules (CLAUDE.md section 7):
* "Referable DR" = grade >= 2, OR continuous score >= the referral threshold. The referral
  threshold is chosen on VALIDATION data for high sensitivity and sits below the grade-2
  cut-off, so it creates a safety band: grade-1 scores close to moderate NPDR are referred
  ("borderline"), never reported as "you're fine".
* The rule is a single score cut-off, so the evaluated rule is exactly the deployed rule.
  (Run 1 stacked an extra margin and a view-instability rule on top of a threshold that was
  chosen without them; that double-counted safety and referred almost everyone.)
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from .thresholds import DEFAULT_THRESHOLDS, apply_thresholds

GRADE_LABELS = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}

RECOMMENDATIONS_EN = {
    "routine": "No referable diabetic retinopathy detected. Rescreen in 12 months.",
    "refer": "Refer to an eye specialist (ophthalmologist) for examination.",
    "urgent": "Refer URGENTLY to an eye specialist. There may be a risk to sight.",
}

MAX_CONFIDENCE = 0.95
TTA_STD_SCALE = 0.5  # TTA std at which agreement reaches 0


@dataclass(frozen=True)
class DecisionConfig:
    grade_thresholds: tuple[float, ...] = tuple(DEFAULT_THRESHOLDS)
    referral_threshold: float = 1.5


@dataclass
class Decision:
    grade: int
    grade_label: str
    continuous_score: float
    confidence: float
    referable: bool
    urgency: str  # routine | refer | urgent
    borderline: bool
    recommendation_en: str
    decision_reason: str

    def to_dict(self) -> dict:
        return asdict(self)


def heuristic_confidence(score: float, tta_scores: list[float], thresholds: tuple[float, ...]) -> float:
    """Heuristic (NOT calibrated) confidence in [0, 1].

    Combines (a) distance of the score from the nearest grade boundary (0.5 at a boundary,
    MAX_CONFIDENCE at a class centre) with (b) agreement between test-time-augmentation views.
    Capped below 1.0 on purpose: a screening heuristic must never claim certainty.
    """
    margin = float(np.min(np.abs(np.asarray(thresholds) - score)))
    boundary_term = 0.5 + (MAX_CONFIDENCE - 0.5) * min(margin / 0.5, 1.0)
    std = float(np.std(tta_scores)) if len(tta_scores) > 1 else 0.0
    agreement = max(0.0, 1.0 - std / TTA_STD_SCALE)
    return round(boundary_term * agreement, 4)


def decide(score: float, tta_scores: list[float], cfg: DecisionConfig) -> Decision:
    grade = int(apply_thresholds(np.array([score]), list(cfg.grade_thresholds))[0])
    confidence = heuristic_confidence(score, tta_scores, cfg.grade_thresholds)

    by_grade = grade >= 2
    by_threshold = score >= cfg.referral_threshold
    referable = by_grade or by_threshold
    # Referred only because of the sensitivity-first safety band (grade estimate is 0-1).
    borderline = by_threshold and not by_grade

    if grade >= 3:
        urgency, reason = "urgent", "Predicted grade is severe NPDR or proliferative DR."
    elif referable:
        urgency = "refer"
        if by_grade:
            reason = "Predicted grade is moderate NPDR (referable)."
        else:
            reason = "Score is in the safety band just below moderate NPDR: referred as a precaution."
    else:
        urgency, reason = "routine", "No referable DR predicted."

    return Decision(
        grade=grade,
        grade_label=GRADE_LABELS[grade],
        continuous_score=round(float(score), 4),
        confidence=confidence,
        referable=bool(referable),
        urgency=urgency,
        borderline=bool(borderline),
        recommendation_en=RECOMMENDATIONS_EN[urgency],
        decision_reason=reason,
    )
