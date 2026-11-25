import cv2
import numpy as np
import pytest

from nazarai_ml.decision import DecisionConfig, decide
from nazarai_ml.preprocess import ImageDecodeError, crop_black_border, decode_image, prepare_fundus, preprocess_for_model
from nazarai_ml.quality import assess_quality
from nazarai_ml.thresholds import apply_thresholds, choose_referral_threshold, optimise_grade_thresholds, qwk


# ---------------------------------------------------------------- preprocessing
def test_preprocess_shapes_and_normalisation(demo_bytes):
    img = decode_image(demo_bytes("grade2-moderate.jpg"))
    x, prepared = preprocess_for_model(img, 384)
    assert x.shape == (3, 384, 384) and x.dtype == np.float32
    assert prepared.display.shape == (384, 384, 3)
    assert prepared.model_input_uint8.dtype == np.uint8
    assert -3 < float(x.mean()) < 3


def test_preprocess_is_deterministic(demo_bytes):
    img = decode_image(demo_bytes("grade0-no-dr.jpg"))
    a, _ = preprocess_for_model(img)
    b, _ = preprocess_for_model(img)
    assert np.array_equal(a, b)


def test_crop_black_border_removes_padding():
    img = np.zeros((300, 500, 3), np.uint8)
    cv2.circle(img, (250, 150), 120, (180, 90, 40), -1)
    cropped = crop_black_border(img)
    assert abs(cropped.shape[0] - 241) <= 2 and abs(cropped.shape[1] - 241) <= 2


def test_mask_outside_circle_is_black(demo_bytes):
    p = prepare_fundus(decode_image(demo_bytes("grade3-severe.jpg")))
    assert p.model_input_uint8[0, 0].sum() == 0 and p.display[0, 0].sum() == 0


def test_decode_rejects_garbage():
    with pytest.raises(ImageDecodeError):
        decode_image(b"not an image")


# ---------------------------------------------------------------- quality gate
@pytest.mark.parametrize("name", ["grade0-no-dr.jpg", "grade1-mild.jpg", "grade2-moderate.jpg",
                                  "grade3-severe.jpg", "grade4-proliferative.jpg"])
def test_quality_accepts_good_fundus(demo_bytes, name):
    q = assess_quality(decode_image(demo_bytes(name)))
    assert q.ok, q.issues


def test_quality_rejects_unsuitable_demo(demo_bytes):
    q = assess_quality(decode_image(demo_bytes("unsuitable-low-quality.jpg")))
    assert not q.ok and "blurry" in [i.code for i in q.issues]


def test_quality_rejects_blur_dark_and_overexposure(demo_bytes):
    img = decode_image(demo_bytes("grade0-no-dr.jpg"))
    assert "blurry" in [i.code for i in assess_quality(cv2.GaussianBlur(img, (0, 0), 8)).issues]
    assert "too_dark" in [i.code for i in assess_quality((img * 0.25).astype(np.uint8)).issues]
    over = np.clip(img.astype(np.float32) * 3, 0, 255).astype(np.uint8)
    assert "overexposed" in [i.code for i in assess_quality(over).issues]


def test_quality_rejects_non_retina():
    rng = np.random.default_rng(0)
    photo = rng.integers(60, 200, (480, 640, 3), dtype=np.uint8)  # textured, no dark border
    q = assess_quality(photo)
    assert not q.ok and "not_retina" in [i.code for i in q.issues]
    tiny = np.zeros((100, 100, 3), np.uint8)
    assert "too_small" in [i.code for i in assess_quality(tiny).issues]


# ---------------------------------------------------------------- decision rules
CFG = DecisionConfig((0.5, 1.5, 2.5, 3.5), referral_threshold=1.4)


def test_decision_grades_and_urgency():
    assert decide(0.1, [0.1] * 4, CFG).urgency == "routine"
    d = decide(2.0, [2.0] * 4, CFG)
    assert d.grade == 2 and d.referable and d.urgency == "refer"
    assert decide(3.0, [3.0] * 4, CFG).urgency == "urgent"
    assert decide(3.9, [3.9] * 4, CFG).grade_label == "Proliferative DR"


def test_safety_band_is_referred_never_routine():
    d = decide(1.45, [1.45] * 4, CFG)  # grade 1 by thresholds, but above the referral threshold
    assert d.grade == 1 and d.referable and d.borderline and d.urgency == "refer"


def test_below_referral_threshold_is_routine():
    d = decide(1.3, [1.3] * 4, CFG)  # grade 1, below the validation-chosen referral threshold
    assert d.grade == 1 and not d.referable and not d.borderline and d.urgency == "routine"


def test_grade2_referred_without_borderline_flag():
    d = decide(1.8, [1.8] * 4, CFG)
    assert d.grade == 2 and d.referable and not d.borderline


def test_confidence_bounds():
    for s in np.linspace(0, 4, 41):
        c = decide(float(s), [float(s)] * 4, CFG).confidence
        assert 0 <= c <= 1


# ---------------------------------------------------------------- thresholds
def test_threshold_optimisation_improves_qwk():
    rng = np.random.default_rng(1)
    y = rng.integers(0, 5, 600)
    scores = y * 0.8 + 0.3 + rng.normal(0, 0.3, 600)  # biased model
    base = qwk(y, apply_thresholds(scores, [0.5, 1.5, 2.5, 3.5]))
    t = optimise_grade_thresholds(scores, y)
    assert qwk(y, apply_thresholds(scores, t)) >= base
    assert t == sorted(t)


def test_referral_threshold_meets_target_sensitivity_with_deployed_rule():
    rng = np.random.default_rng(2)
    y = rng.integers(0, 5, 800)
    scores = y + rng.normal(0, 0.6, 800)
    r = choose_referral_threshold(scores, y, [0.5, 1.5, 2.5, 3.5], 0.9)
    assert r["threshold"] <= 1.5  # never above the grade-2 cut-off
    cfg = DecisionConfig((0.5, 1.5, 2.5, 3.5), r["threshold"])
    referred = np.array([decide(float(s), [float(s)] * 4, cfg).referable for s in scores])
    pos = y >= 2
    sens = (referred & pos).sum() / pos.sum()
    spec = (~referred & ~pos).sum() / (~pos).sum()
    assert sens >= 0.9 and abs(sens - r["sensitivity"]) < 1e-9 and abs(spec - r["specificity"]) < 1e-9


def test_referral_threshold_picks_best_specificity():
    y = np.array([0] * 50 + [2] * 50)
    scores = np.concatenate([np.linspace(0, 1.0, 50), np.linspace(1.2, 2.5, 50)])
    r = choose_referral_threshold(scores, y, [0.5, 1.5, 2.5, 3.5], 0.9)
    assert r["specificity"] == 1.0 and r["sensitivity"] >= 0.9


def test_downscale_cache_keeps_model_input(tmp_path, demo_bytes):
    """Caching a downscaled copy (used for APTOS on Kaggle) must not change what the model sees."""
    import pandas as pd

    from nazarai_ml.dataset import cache_downscaled
    from nazarai_ml.preprocess import read_image

    big = cv2.resize(cv2.cvtColor(decode_image(demo_bytes("grade3-severe.jpg")), cv2.COLOR_RGB2BGR),
                     (3000, 2000), interpolation=cv2.INTER_CUBIC)
    src = tmp_path / "big.png"
    cv2.imwrite(str(src), big)
    out = cache_downscaled(pd.DataFrame({"path": [str(src)], "grade": [3]}), str(tmp_path / "cache"), 1024, workers=1)
    cached = read_image(out.path[0])
    assert max(cached.shape[:2]) == 1024
    a, b = prepare_fundus(read_image(str(src))), prepare_fundus(cached)
    diff = lambda x, y: np.abs(x.astype(np.float32) - y.astype(np.float32)).mean()  # grey levels /255
    # Measured: cache 0.55 (display) / 2.1 (model input, Ben Graham amplifies x4); a JPEG q95
    # re-save of the same image gives 2.5 / 8.5. Bounds keep the cache well below that.
    assert diff(a.display, b.display) < 1.0
    assert diff(a.model_input_uint8, b.model_input_uint8) < 4.0
