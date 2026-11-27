"""Build docs/NazarAI_ML_Technical_Brief.pdf: every AI/ML choice in NazarAI and the reason for it.

    backend/.venv/Scripts/python scripts/make_ml_brief.py

All result numbers are read from ml/reports/metrics.json and the archived run folders, so the PDF
stays in sync with the deployed model. Re-run after a new training run.
"""
from __future__ import annotations

import json
from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "NazarAI_ML_Technical_Brief.pdf"
REPORTS = ROOT / "ml" / "reports"

# ---------------------------------------------------------------- fonts & styles
FONT_DIR = Path("C:/Windows/Fonts")
try:
    pdfmetrics.registerFont(TTFont("Body", str(FONT_DIR / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("Body-Bold", str(FONT_DIR / "segoeuib.ttf")))
    pdfmetrics.registerFont(TTFont("Body-Italic", str(FONT_DIR / "segoeuii.ttf")))
    pdfmetrics.registerFont(TTFont("Mono", str(FONT_DIR / "consola.ttf")))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body-Italic", boldItalic="Body-Bold")
    BODY, BOLD, MONO = "Body", "Body-Bold", "Mono"
except Exception:  # non-Windows fallback (symbols such as >= may then render as boxes)
    BODY, BOLD, MONO = "Helvetica", "Helvetica-Bold", "Courier"

TEAL = colors.HexColor("#0E5E63")
TEAL_LIGHT = colors.HexColor("#E6F2F2")
INK = colors.HexColor("#1B2426")
MUTED = colors.HexColor("#5B6B6E")
RULE = colors.HexColor("#C9D6D7")
AMBER_BG = colors.HexColor("#FFF5E0")
AMBER = colors.HexColor("#8A5A00")

S = {
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=24, leading=29, textColor=TEAL, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", fontName=BODY, fontSize=12.5, leading=17, textColor=MUTED, spaceAfter=14),
    "h1": ParagraphStyle("h1", fontName=BOLD, fontSize=16, leading=20, textColor=TEAL, spaceBefore=4, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName=BOLD, fontSize=12, leading=15.5, textColor=INK, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=BODY, fontSize=9.8, leading=14, textColor=INK, spaceAfter=5, alignment=TA_LEFT),
    "small": ParagraphStyle("small", fontName=BODY, fontSize=8.4, leading=11.5, textColor=MUTED, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName=BODY, fontSize=8.8, leading=11.8, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName=BOLD, fontSize=8.8, leading=11.8, textColor=INK),
    "head": ParagraphStyle("head", fontName=BOLD, fontSize=8.8, leading=11.8, textColor=colors.white),
    "bullet": ParagraphStyle("bullet", fontName=BODY, fontSize=9.8, leading=14, textColor=INK, leftIndent=12,
                             bulletIndent=2, spaceAfter=2.5),
    "q": ParagraphStyle("q", fontName=BOLD, fontSize=10, leading=14, textColor=TEAL, spaceBefore=7, spaceAfter=1),
    "callout": ParagraphStyle("callout", fontName=BODY, fontSize=9.6, leading=13.6, textColor=INK),
}


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullets(items: list[str]) -> list[Paragraph]:
    return [Paragraph(t, S["bullet"], bulletText="•") for t in items]


def table(rows: list[list], widths: list[float], header: bool = True, zebra: bool = True) -> Table:
    data = []
    for r, row in enumerate(rows):
        style = "head" if header and r == 0 else "cell"
        data.append([c if not isinstance(c, str) else Paragraph(c, S[style]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    st = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
    ]
    if header:
        st.append(("BACKGROUND", (0, 0), (-1, 0), TEAL))
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if i % 2 == 0:
                st.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F4F8F8")))
    t.setStyle(TableStyle(st))
    return t


def callout(text: str, kind: str = "info") -> Table:
    bg, bar = (TEAL_LIGHT, TEAL) if kind == "info" else (AMBER_BG, AMBER)
    t = Table([[Paragraph(text, S["callout"])]], colWidths=[17 * cm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, bar),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def pct(x: float, d: int = 1) -> str:
    return f"{100 * x:.{d}f}%"


# ---------------------------------------------------------------- data
M = json.loads((REPORTS / "metrics.json").read_text(encoding="utf-8"))
model = M["model"]
val, ext = M["splits"]["validation"], M["splits"]["external_test"]
vr, er = val["referable"], ext["referable"]
inf = M["inference"]
bench = M["benchmark"]

run_dirs = {
    "EyePACS only (run 1)": ROOT / "ml/runs/eyepacs-fallback-202611250727/reports/metrics.json",
    "APTOS 2019 only (run 2)": ROOT / "ml/runs/aptos-only-202611251200/reports/metrics.json",
    "APTOS 2019 + EyePACS (run 3, deployed)": REPORTS / "metrics.json",
}
runs = {k: json.loads(p.read_text(encoding="utf-8")) for k, p in run_dirs.items() if p.exists()}
history_path = ROOT / "ml/runs/aptos-eyepacs-202611251638/history.json"
history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else []
best_epoch = max(history, key=lambda h: h["val_qwk_default_thresholds"]) if history else None
cfg_path = ROOT / "ml/runs/aptos-eyepacs-202611251638/model_config.json"
if cfg_path.exists():  # training-time fields (epochs, QWK before/after threshold tuning) live here
    model = {**json.loads(cfg_path.read_text(encoding="utf-8")), **model}

val_ref_prev = (vr["tp"] + vr["fn"]) / val["n_images"]
ext_ref_prev = (er["tp"] + er["fn"]) / ext["n_images"]
gt = model["grade_thresholds"]
t_ref = model["referral_threshold"]


# ---------------------------------------------------------------- pipeline diagram
def pipeline_diagram() -> Drawing:
    w, h = 17 * cm, 6.4 * cm
    d = Drawing(w, h)
    boxes_top = [
        ("Retina photo", "upload / sample"),
        ("Quality gate", "OpenCV heuristics"),
        ("Preprocess", "crop, 384 px, Ben Graham"),
        ("EfficientNet-B3", "ONNX, 4 flip views"),
    ]
    boxes_bot = [
        ("Score 0-4", "mean of 4 views"),
        ("Decision rule", "grade cut-offs + referral t"),
        ("Grad-CAM", "where the model looked"),
        ("Report + PDF", "Urdu / English"),
    ]
    bw, bh, gap = 3.6 * cm, 1.75 * cm, 0.87 * cm

    def row(items, y, reverse=False):
        xs = []
        for i, (title, sub) in enumerate(items):
            x = i * (bw + gap)
            if reverse:
                x = w - bw - i * (bw + gap)
            xs.append(x)
            d.add(Rect(x, y, bw, bh, rx=6, ry=6, fillColor=TEAL_LIGHT, strokeColor=TEAL, strokeWidth=1))
            d.add(String(x + bw / 2, y + bh - 0.68 * cm, title, fontName=BOLD, fontSize=9.5, fillColor=TEAL,
                         textAnchor="middle"))
            d.add(String(x + bw / 2, y + 0.42 * cm, sub, fontName=BODY, fontSize=7.4, fillColor=MUTED,
                         textAnchor="middle"))
        return xs

    def arrow(x1, y1, x2, y2):
        d.add(Line(x1, y1, x2, y2, strokeColor=MUTED, strokeWidth=1.2))
        if x2 > x1:
            pts = [x2, y2, x2 - 5, y2 + 3, x2 - 5, y2 - 3]
        elif x2 < x1:
            pts = [x2, y2, x2 + 5, y2 + 3, x2 + 5, y2 - 3]
        else:
            pts = [x2, y2, x2 - 3, y2 + 5, x2 + 3, y2 + 5]
        d.add(Polygon(pts, fillColor=MUTED, strokeColor=MUTED))

    yt, yb = h - bh - 0.2 * cm, 0.55 * cm
    xt = row(boxes_top, yt)
    xb = row(boxes_bot, yb, reverse=True)
    for i in range(3):
        arrow(xt[i] + bw, yt + bh / 2, xt[i + 1], yt + bh / 2)
        arrow(xb[i], yb + bh / 2, xb[i + 1] + bw, yb + bh / 2)
    arrow(xt[3] + bw / 2, yt, xb[0] + bw / 2, yb + bh)
    # rejected branch
    d.add(String(xt[1] + bw / 2, yt - 0.42 * cm, "bad photo -> rejected, retake", fontName=BODY, fontSize=7.4,
                 fillColor=AMBER, textAnchor="middle"))
    return d


# ---------------------------------------------------------------- page decoration
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 7.8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1.2 * cm, f"NazarAI - ML technical brief - model {model['model_version']}")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)
    canvas.restoreState()


# ---------------------------------------------------------------- content
story: list = []
W = 17 * cm

# Cover / summary
story += [
    Spacer(1, 0.4 * cm),
    P("NazarAI: what we built on the AI side, and why", "title"),
    P("Datasets, image quality, preprocessing, the deep-learning model, training, the referral rule, "
      "explainability, evaluation, deployment and the language model. Every choice with its reason, so the ML "
      "lead can defend it to the jury and brief the team.", "subtitle"),
    table([
        ["Item", "Value"],
        ["Deployed model", f"<b>{model['model_version']}</b>"],
        ["Architecture", "EfficientNet-B3 CNN (10.7 M parameters), ImageNet pretrained, single regression output"],
        ["Training data", f"APTOS 2019 (India) + EyePACS 2015 (USA): {model['n_train']:,} training and "
                          f"{val['n_images']:,} validation images"],
        ["External test", f"IDRiD (India), all {ext['n_images']} graded images, never trained or tuned on"],
        ["Referable DR on IDRiD", f"sensitivity <b>{pct(er['sensitivity'])}</b>, specificity {pct(er['specificity'])}, "
                                  f"AUC {er['auc']:.3f}, QWK {ext['qwk']:.3f}"],
        ["Referable DR on validation", f"sensitivity {pct(vr['sensitivity'])}, specificity {pct(vr['specificity'])}, "
                                       f"AUC {vr['auc']:.3f}, QWK {val['qwk']:.3f}"],
        ["Benchmark", f"IDx-DR (FDA-cleared 2018): sensitivity {pct(bench['sensitivity'], 0)}, specificity "
                      f"{pct(bench['specificity'], 0)}"],
        ["Speed", f"{inf['mean_ms']:.0f} ms per image on CPU (mean), {inf['p95_ms']:.0f} ms p95, without Grad-CAM"],
    ], [4.2 * cm, 12.8 * cm]),
    Spacer(1, 0.5 * cm),
    P("The whole pipeline", "h2"),
    pipeline_diagram(),
    Spacer(1, 0.3 * cm),
    callout("<b>The one-sentence version for the jury:</b> a quality gate rejects bad photos; an ImageNet-pretrained "
            "EfficientNet-B3, fine-tuned on about 33,000 graded retina photos, predicts a continuous severity score; "
            "cut-offs tuned on validation data turn it into a grade and a referral decision set for at least 90% "
            "sensitivity; Grad-CAM shows where it looked; and we report the result on a separate Indian dataset the "
            "model never saw."),
    PageBreak(),
]

# 1. Problem framing
story += [
    P("1. How we framed the problem", "h1"),
    P("<b>The task:</b> grade diabetic retinopathy (DR) on the International Clinical DR scale: 0 no DR, 1 mild, "
      "2 moderate, 3 severe, 4 proliferative. Clinically, one binary question matters most: is the patient "
      "<b>referable</b> (grade 2 or worse) and must see an eye specialist?"),
    P("Ordinal regression instead of 5-class classification", "h2"),
    P("The model outputs <b>one number between 0 and 4</b>, not five class probabilities. Why:"),
    *bullets([
        "<b>Grades are ordered.</b> Predicting 3 for a true 4 is a small mistake; predicting 0 for a true 4 is a "
        "dangerous one. A regression loss punishes the second far more. Softmax treats all wrong classes as "
        "equally wrong.",
        "<b>It matches the metric.</b> Quadratic Weighted Kappa (QWK) also penalises errors by the square of their "
        "distance. Regression plus tuned cut-offs was the standard winning approach in the APTOS 2019 Kaggle "
        "competition.",
        "<b>One score makes safety rules simple.</b> The referral decision becomes a single threshold on the score, "
        "which we can set for high sensitivity and evaluate exactly as deployed.",
    ]),
    P("Sensitivity first", "h2"),
    P("A false referral costs the patient one extra clinic visit. A missed referable case can cost their sight. So "
      "every threshold is chosen to <b>catch at least 90% of referable cases on validation data</b>, and accepts "
      "lower specificity (more unnecessary referrals) as the price. IDx-DR, the FDA-cleared benchmark, reported 87% "
      "sensitivity; we set our target above it."),
]

# 2. Datasets
grade_dist_v = val["grade_distribution"]
story += [
    P("2. Datasets: what and why", "h1"),
    table([
        ["Dataset", "Images", "Origin", "Our use", "Why"],
        ["<b>APTOS 2019</b> (Kaggle, Aravind Eye Hospital)", "3,662", "India",
         "Training + validation", "Closest public population to Pakistan; many cameras and mixed quality, like "
         "real Basic Health Units."],
        ["<b>EyePACS 2015</b> (Kaggle DR Detection, resized community copy)", "about 35,000", "USA",
         "Training + validation", "Ten times more data. APTOS alone was too small and did not generalise "
         "(see the run history below)."],
        ["<b>IDRiD</b> (Indian DR Image Database, CC BY 4.0 mirror)", f"{ext['n_images']}", "India",
         "<b>External test only</b>", "Independent hospital, camera and graders. Never used for training or for "
         "any grading threshold, so the result is an honest estimate."],
    ], [3.6 * cm, 1.7 * cm, 1.3 * cm, 2.6 * cm, 7.8 * cm]),
    Spacer(1, 0.25 * cm),
    P("Datasets we did not use, and why", "h2"),
    *bullets([
        "<b>Pakistani data:</b> no usable public graded set exists (one Rawalpindi set has 100 images with only 4 DR "
        "cases; the PCSIR set is not released). A pilot with a local eye hospital is the next step.",
        "<b>Messidor-2:</b> requires registration and approval; not feasible within the 24-hour window.",
        "<b>EyeQ</b> (quality labels): would train a learned quality model; we used rule-based checks instead (section 3).",
    ]),
    P("How the data was split", "h2"),
    *bullets([
        "<b>Patient-level split</b> (scikit-learn StratifiedGroupKFold, 15% validation, seed 42). EyePACS has the "
        "left and right eye of each patient; both eyes always go to the same side. Otherwise the model could "
        "\"recognise\" a patient's other eye and the validation score would be inflated. APTOS has no patient IDs, "
        "so its split is per image.",
        "<b>Stratified by grade</b> so the rare severe grades appear in both training and validation.",
        f"<b>Result:</b> {model['n_train']:,} training images and {val['n_images']:,} validation images. Validation "
        f"grade counts 0-4: {', '.join(f'{c:,}' for c in grade_dist_v)}.",
    ]),
    P("Class imbalance", "h2"),
    P(f"Grade 0 is {pct(grade_dist_v[0] / sum(grade_dist_v), 0)} of validation images and grade 4 only "
      f"{pct(grade_dist_v[4] / sum(grade_dist_v), 0)}. We handle this with the <b>regression + tuned cut-offs</b> "
      "design: the cut-offs move to wherever separates the grades best, instead of re-weighting the data. The "
      "training code supports a balanced sampler (inverse square-root class weights), but it was <b>off</b> in the "
      "deployed run: oversampling a few hundred severe images over 10 epochs risks memorising them. We did not "
      "have time for an ablation comparing the two."),
    P("Image caching (engineering, not modelling)", "h2"),
    P("APTOS images are large PNGs and made each epoch slow. We cached them once with the longer side capped at "
      "1024 px (lossless). A unit test shows the difference this makes to the model input is about four times "
      "smaller than simply re-saving the image as a high-quality JPEG."),
]

# Run history
story += [P("Run history: why the final model uses both datasets", "h2")]
rows = [["Run", "Train images", "Val QWK", "IDRiD sens.", "IDRiD spec.", "IDRiD AUC", "IDRiD QWK"]]
for name, r in runs.items():
    e = r["splits"]["external_test"]
    rows.append([name, f"{r['model']['n_train']:,}", f"{r['splits']['validation']['qwk']:.3f}",
                 pct(e["referable"]["sensitivity"]), pct(e["referable"]["specificity"]),
                 f"{e['referable']['auc']:.3f}", f"{e['qwk']:.3f}"])
story += [
    table(rows, [5.0 * cm, 2.1 * cm, 1.7 * cm, 2.1 * cm, 2.1 * cm, 2.0 * cm, 2.0 * cm]),
    Spacer(1, 0.2 * cm),
    *bullets([
        "<b>EyePACS only:</b> caught every referable case on IDRiD but referred almost half of the healthy eyes.",
        "<b>APTOS only:</b> looked excellent on its own validation set (QWK 0.869) but <b>missed 77 referable eyes</b> "
        "on IDRiD. A small dataset (3,138 training images) overfits to its own cameras and graders.",
        "<b>Both together:</b> the best balance: 2 referable eyes missed out of 323, AUC 0.984.",
    ]),
    callout("<b>Honesty note (say this if asked):</b> the grading cut-offs and the referral threshold were always "
            "fitted on validation data only. But the team's decision to add EyePACS after run 2 was made after seeing "
            "run 2's IDRiD result, so IDRiD influenced which training data we chose. That is a mild form of test-set "
            "influence and is disclosed in DECISIONS.md. A fresh external test set (e.g. Messidor-2 or a Pakistani "
            "pilot) would remove it.", "warn"),
    PageBreak(),
]

# 3. Quality gate
story += [
    P("3. Image quality gate (classical computer vision)", "h1"),
    P("Runs <b>before</b> the model. A bad photo is <b>rejected with a reason</b> (\"blurry, refocus and retake\"), "
      "never graded. A neural network will always output some grade, even for a photo of a hand, so this gate is "
      "a safety requirement."),
    table([
        ["Check", "How", "Threshold", "Why"],
        ["Blur", "Variance of the Laplacian (edge sharpness) inside the retina, image first rescaled to 512 px",
         "at least 12", "Blur hides microaneurysms; rescaling makes the score independent of camera resolution."],
        ["Exposure", "Mean grey level inside the retina; fraction of blown-out green pixels",
         "30 to 200; at most 8% saturated", "Too dark or over-exposed photos hide lesions. Green is used for "
         "over-exposure because red clips even in good photos."],
        ["Is it a retina?", "Largest bright region: area, roundness (area / enclosing circle), dark corners, "
         "red-to-blue ratio", "at least 20% of image; roundness 0.65; 2 dark corners; red/blue 1.6",
         "Fundus photos are a round reddish disc on black. Rejects selfies, documents, screenshots."],
        ["Size / shape", "Minimum side and aspect ratio", "at least 224 px; ratio at most 2", "Too small to grade."],
    ], [2.2 * cm, 5.4 * cm, 3.2 * cm, 6.2 * cm]),
    Spacer(1, 0.2 * cm),
    P("<b>Why rules instead of a learned quality model:</b> no time to train on EyeQ within 24 hours; rules run in "
      "milliseconds, never fail silently, and each one maps to a clear instruction for the health worker."),
    P("<b>How it was tuned:</b> on the 103 IDRiD test-split photos plus deliberately damaged copies: accepted 102 of "
      "103 real photos (the rejected one is genuinely hazy), rejected 15/15 blurred, 15/15 dark, 12/15 over-exposed "
      "and 12/12 non-retina images. Note: these are IDRiD photos, but the gate only decides accept or reject; it "
      "never touches grading or the referral threshold.", "body"),
]

# 4. Preprocessing
story += [
    P("4. Preprocessing", "h1"),
    P("One shared Python module (<font name='%s'>nazarai_ml/preprocess.py</font>) is used by training and by the "
      "live service. If training and inference preprocess even slightly differently, accuracy drops silently, so "
      "there is exactly one implementation." % MONO),
    table([
        ["Step", "What", "Why"],
        ["1. Crop border", "Remove the black frame around the circular retina", "The frame carries no information "
         "and varies by camera."],
        ["2. Pad to square", "Centre on a black square canvas", "A plain resize would squash the circle; EyePACS "
         "photos are often cut off at the top and bottom."],
        ["3. Resize to 384 x 384", "Model input size", "EfficientNet-B3 is designed for about 300 px. 384 keeps "
         "microaneurysms (a few pixels wide) visible while still fitting a batch of 24 on a 16 GB Kaggle T4 GPU."],
        ["4. Ben Graham enhancement", "4 x image - 4 x GaussianBlur(image, sigma = size/30) + 128, then a circular "
         "mask at 96% radius", "From the 2015 Kaggle DR winner. Subtracting the local average removes uneven "
         "lighting and camera colour cast and makes small lesions stand out."],
        ["5. Normalise", "ImageNet mean and standard deviation", "The pretrained backbone expects inputs on the "
         "same scale as the ImageNet images it learned from."],
    ], [3.2 * cm, 5.6 * cm, 8.2 * cm]),
    PageBreak(),
]

# 5. Model
story += [
    P("5. The deep-learning model", "h1"),
    P("Architecture: EfficientNet-B3", "h2"),
    P("A convolutional neural network (CNN) from the <font name='%s'>timm</font> library, 10.7 million parameters. "
      "The convolutional layers turn the 384 x 384 image into a 1,536-number feature vector; we replaced the "
      "1,000-class ImageNet classifier with <b>one output neuron</b> (the severity score)." % MONO),
    table([
        ["Alternative", "Why we did not pick it"],
        ["ResNet-50", "About twice the parameters for similar or lower accuracy; EfficientNet scales depth, width and "
         "resolution together and is more efficient per parameter."],
        ["EfficientNet-B5 / B7", "Better on paper but 2-5 times slower to train; would not fit our 6-8 GPU-hour "
         "budget or run fast enough on a free CPU."],
        ["Vision Transformer (ViT)", "Needs much more data than 33k images to beat CNNs; weaker at the tiny local "
         "details (microaneurysms) that DR grading depends on."],
        ["ConvNeXt-Tiny", "A good second choice and supported by our code. Kept as the ensemble partner if time "
         "allowed; it did not."],
    ], [4.0 * cm, 13.0 * cm]),
    P("Transfer learning from ImageNet", "h2"),
    P("We start from weights trained on 1.2 million everyday photos instead of random weights. The early layers "
      "already detect edges, blobs and textures, which is exactly what lesions are made of. With only 33k retina "
      "photos, training from scratch would overfit and need far longer."),
    P("Why dropout 0.3", "h2"),
    *bullets([
        "<b>What it does:</b> during training, 30% of the 1,536 features are randomly set to zero before the final "
        "layer, so the output cannot rely on any single feature. At inference nothing is dropped.",
        "<b>Why we need it:</b> 10.7 M parameters versus 33k images is plenty of capacity to memorise. Dropout is "
        "cheap regularisation that pushes the model to spread its evidence across many lesion features.",
        "<b>Why 0.3:</b> it is the value the EfficientNet authors used for B3 (and timm's default). With a 24-hour "
        "budget we kept the tested default rather than tuning it.",
    ]),
    P("Why SmoothL1 (Huber) loss", "h2"),
    P("For small errors it behaves like squared error (smooth, precise); for large errors it behaves like absolute "
      "error, so a few <b>mislabelled images</b> cannot dominate training. DR labels are noisy: expert graders "
      "often disagree by one grade, and EyePACS labels come from a single grader."),
]

# 6. Training
hist_rows = [["Epoch", "Train loss", "Val QWK*", "Time"]]
for h in history:
    mark = " (best, kept)" if best_epoch and h["epoch"] == best_epoch["epoch"] else ""
    hist_rows.append([f"{h['epoch'] + 1}{mark}", f"{h['train_loss']:.3f}", f"{h['val_qwk_default_thresholds']:.3f}",
                      f"{h['seconds'] / 60:.0f} min"])
story += [
    P("6. Training recipe", "h1"),
    table([
        ["Setting", "Value", "Why"],
        ["Platform", "Kaggle Notebook, NVIDIA T4 (16 GB)", "Free GPU with the datasets already mounted; no 10+ GB "
         "downloads to a laptop."],
        ["Optimiser", "AdamW, weight decay 1e-4", "Adam's adaptive steps with weight decay applied correctly "
         "(decoupled); the standard choice for fine-tuning CNNs."],
        ["Learning rates", "1e-4 backbone, 1e-3 head (10x)", "The pretrained backbone needs gentle updates so it "
         "keeps what it learned; the new random head needs to learn fast."],
        ["Schedule", "Linear warm-up for half an epoch, then cosine decay", "At the start the random head sends large, "
         "noisy gradients that could damage pretrained weights; warm-up prevents that. Cosine decay ends with tiny "
         "steps for fine convergence without hand-tuned drops."],
        ["Mixed precision (AMP)", "float16 compute with a gradient scaler", "About twice as fast and half the memory "
         "on the T4's tensor cores; the scaler prevents tiny gradients from rounding to zero."],
        ["Batch size", "24", "The largest that fits 384 px images on 16 GB."],
        ["Epochs", f"{model.get('epochs', 10)} (about {sum(h['seconds'] for h in history) / 3600:.1f} GPU hours)",
         "Fits the GPU-hour budget; validation QWK had flattened by the end (table)."],
        ["Checkpoint", "Best epoch by validation QWK", "Keeps the best model, not simply the last one."],
    ], [3.0 * cm, 4.6 * cm, 9.4 * cm]),
    Spacer(1, 0.2 * cm),
    P("Augmentation (albumentations): what we did and did not do", "h2"),
    table([
        ["Augmentation", "Why"],
        ["Horizontal and vertical flips", "Left and right eyes are mirror images; photos have no fixed orientation."],
        ["Rotation up to 180 degrees (90% of images)", "A retina has no \"up\"; teaches rotation invariance and "
         "multiplies the effective data."],
        ["Small scale (0.92-1.08) and shift (4%)", "Different cameras frame the retina slightly differently."],
        ["Brightness and contrast up to 10%", "Different flash strengths and cameras."],
        ["<b>Not used:</b> colour or hue shifts", "Lesion colour is diagnostic: red haemorrhages, yellow exudates. "
         "Changing hue could turn one into the other."],
        ["<b>Not used:</b> cut-out or elastic warps", "Could erase a real lesion or create a fake one, which would "
         "make the label wrong."],
    ], [5.2 * cm, 11.8 * cm]),
]
if history:
    story += [
        P("Training curve (deployed run)", "h2"),
        table(hist_rows, [3.4 * cm, 2.6 * cm, 2.6 * cm, 2.4 * cm]),
        P("* QWK with the default cut-offs (0.5 / 1.5 / 2.5 / 3.5). Tuned cut-offs raise the best epoch to "
          f"{model.get('val_qwk_optimised_thresholds', val['qwk']):.3f}.", "small"),
    ]
story += [PageBreak()]

# 7. Decision layer
story += [
    P("7. From score to decision", "h1"),
    P("Grade cut-offs: tuned for QWK", "h2"),
    P(f"Default cut-offs (0.5, 1.5, 2.5, 3.5) are rarely optimal. We search for the four cut-offs that maximise "
      f"QWK on <b>validation</b> data using the <b>Nelder-Mead</b> method, started from several points. Why "
      f"Nelder-Mead: QWK is a step function of the cut-offs, so it has no gradient; Nelder-Mead needs only function "
      f"values. Several starting points avoid a poor local optimum. Final cut-offs: "
      f"<b>{' / '.join(f'{t:.2f}' for t in gt)}</b>. Validation QWK went from "
      f"{model.get('val_qwk_default_thresholds', 0):.3f} to {model.get('val_qwk_optimised_thresholds', val['qwk']):.3f}."),
    P("Referral threshold: tuned for sensitivity", "h2"),
    P(f"Referable = predicted grade 2 or higher <b>or</b> score at least <b>{t_ref:.3f}</b>. That threshold is "
      f"chosen on validation data as the highest value that still catches at least 90% of referable eyes (it "
      f"reached {pct(model['referral_selection']['sensitivity'])} with specificity "
      f"{pct(model['referral_selection']['specificity'])}). Because it sits <b>below</b> the grade-2 cut-off "
      f"({gt[1]:.2f}), it creates a <b>safety band</b>: an eye that scores as mild but close to moderate is "
      f"referred and marked \"borderline / precaution\", never told \"you are fine\"."),
    P("Urgency: grade 0-1 routine (rescreen in 12 months); grade 2 refer; grade 3-4 refer urgently.", "body"),
    callout("<b>Lesson learned (rule v1 to v2):</b> our first rule stacked an extra safety margin and a "
            "\"flip views disagree\" rule on top of a threshold that had been chosen without them. That counted the "
            "safety margin twice and referred almost everyone (0.8% specificity). Rule v2 is one cut-off, chosen "
            "under exactly the rule we deploy, so the evaluated rule is the deployed rule. The fix used validation "
            "data only."),
    P("Test-time augmentation (TTA)", "h2"),
    P("Each photo is scored four times: original, flipped left-right, flipped up-down, and both. The final score is "
      "the average. Averaging reduces random error, and how much the four views disagree feeds the confidence "
      "value. Four flips are cheap (one batch of 4); rotations would cost more time on CPU."),
    P("Confidence value (heuristic, not calibrated)", "h2"),
    P("Confidence = (distance of the score from the nearest grade cut-off, mapped to 50-95%) x (agreement of the "
      "four flip views). It is <b>capped at 95%</b> so the app never shows 100%, and it is labelled "
      "\"not calibrated\" in the UI: it is a sanity signal, not a probability of being correct."),
]

# 8. Explainability
story += [
    P("8. Explainability: Grad-CAM", "h1"),
    *bullets([
        "<b>What:</b> Gradient-weighted Class Activation Mapping (library <font name='%s'>pytorch-grad-cam</font>). "
        "It measures how much each region of the last convolutional layer (<font name='%s'>conv_head</font>) pushes "
        "the severity score <b>up</b>, and overlays that as a heatmap on the retina." % (MONO, MONO),
        "<b>Why Grad-CAM:</b> one forward and one backward pass (a few seconds on the free CPU), works with any CNN without "
        "retraining, and is the most widely used method in medical-imaging papers, so clinicians and judges "
        "recognise it. Alternatives such as SHAP or occlusion maps take tens to hundreds of model runs per image.",
        "<b>Why it matters:</b> a health worker or specialist can see whether the model looked at lesions or at "
        "something irrelevant (an eyelash, a reflection) and override it.",
        "<b>Limits to state honestly:</b> the map is coarse (12 x 12 cells at 384 px input, smoothed up), it shows "
        "where the model looked, not proof that it is right, and we have not yet measured overlap with the IDRiD "
        "lesion masks quantitatively (a side-by-side example for the deck is the recommended next step).",
    ]),
    PageBreak(),
]

# 9. Evaluation
def cm_rows(cmx):
    rows = [["True \\ Predicted", "0", "1", "2", "3", "4"]]
    for i, r in enumerate(cmx):
        rows.append([f"Grade {i}"] + [f"<b>{v}</b>" if i == j else str(v) for j, v in enumerate(r)])
    return rows


story += [
    P("9. Evaluation", "h1"),
    P("What each metric means and why we report it", "h2"),
    table([
        ["Metric", "Meaning", "Why"],
        ["QWK", "Agreement with the true grade, corrected for chance; far-off mistakes are penalised by the square "
         "of the distance. 1 = perfect, 0 = chance.", "The standard metric for 0-4 DR grading (APTOS competition)."],
        ["Sensitivity", "Of all referable eyes, the share we refer.", "Missing disease is the costly error."],
        ["Specificity", "Of all non-referable eyes, the share we correctly do not refer.", "Measures wasted specialist "
         "visits."],
        ["AUC-ROC", "Ranking quality over all possible thresholds (1 = perfect, 0.5 = coin flip).", "Shows model "
         "quality independently of where we put the threshold."],
        ["PPV / NPV", "Of referred eyes, share truly referable / of cleared eyes, share truly fine.", "What a "
         "clinician experiences; depends on how common disease is in the population."],
        ["Confusion matrix", "5 x 5 table of true versus predicted grade.", "Shows which grades get confused."],
    ], [2.6 * cm, 8.0 * cm, 6.4 * cm]),
    Spacer(1, 0.2 * cm),
    P("Results", "h2"),
    table([
        ["Referable DR (grade 2+)", "Validation", "IDRiD external test", "IDx-DR benchmark"],
        ["Images", f"{val['n_images']:,}", f"{ext['n_images']}", "900 patients"],
        ["Sensitivity", pct(vr["sensitivity"]), f"<b>{pct(er['sensitivity'])}</b> ({er['fn']} missed of "
         f"{er['tp'] + er['fn']})", pct(bench["sensitivity"], 0)],
        ["Specificity", pct(vr["specificity"]), pct(er["specificity"]), pct(bench["specificity"], 0)],
        ["AUC", f"{vr['auc']:.3f}", f"<b>{er['auc']:.3f}</b>", "not reported"],
        ["PPV / NPV", f"{pct(vr['ppv'])} / {pct(vr['npv'])}", f"{pct(er['ppv'])} / {pct(er['npv'])}", "-"],
        ["QWK (5 grades)", f"{val['qwk']:.3f}", f"{ext['qwk']:.3f}", "-"],
        ["Referable share", pct(val_ref_prev, 0), pct(ext_ref_prev, 0), "-"],
    ], [4.2 * cm, 3.4 * cm, 5.0 * cm, 4.4 * cm]),
    P(f"IDx-DR: {bench['note']}", "small"),
    Spacer(1, 0.15 * cm),
    P("How to read these numbers", "h2"),
    *bullets([
        f"<b>Sensitivity is above the benchmark</b> on both sets: only {er['fn']} of {er['tp'] + er['fn']} referable "
        "IDRiD eyes were missed.",
        f"<b>Specificity on IDRiD ({pct(er['specificity'])}) is below IDx-DR.</b> {er['fp']} of "
        f"{er['fp'] + er['tn']} non-referable eyes were referred. Reasons: a different camera and hospital shift "
        "scores upward, and our threshold deliberately favours sensitivity. In a pilot, re-fitting the threshold on "
        "local validation data is the standard fix.",
        f"<b>PPV depends on prevalence.</b> {pct(ext_ref_prev, 0)} of IDRiD eyes are referable, far more than in a "
        "routine diabetes clinic, so the real-world PPV would be lower and the NPV higher.",
        f"<b>Mild DR (grade 1) is the weak class</b> (recall {pct(val['per_grade'][1]['recall'], 0)} on validation, "
        f"{pct(ext['per_grade'][1]['recall'], 0)} on IDRiD): its only sign is a few tiny microaneurysms. Clinically "
        "this matters little, because grade 0 and grade 1 lead to the same action (rescreen in 12 months).",
    ]),
]
imgs = []
for name, caption in [("confusion_matrix_validation.png", "Validation"),
                      ("confusion_matrix_external_test.png", "IDRiD external test")]:
    p = REPORTS / name
    if p.exists():
        imgs.append(Image(str(p), width=8.2 * cm, height=7.4 * cm))  # plots carry their own titles
if imgs:
    story += [Spacer(1, 0.2 * cm), KeepTogether([
        P("Confusion matrices", "h2"),
        Table([imgs], colWidths=[8.5 * cm] * len(imgs), hAlign="LEFT"),
    ])]
roc = REPORTS / "roc.png"
if roc.exists():
    story += [KeepTogether([P("ROC curves with the deployed operating point", "h2"),
                            Image(str(roc), width=9.5 * cm, height=9.5 * cm)])]
story += [PageBreak()]

# 10. Deployment
story += [
    P("10. Deployment and inference", "h1"),
    table([
        ["Choice", "Why"],
        ["Export to <b>ONNX</b>, run with <b>onnxruntime</b> on CPU", "Free hosting has no GPU. onnxruntime fuses and "
         f"optimises the network for CPU: {inf['mean_ms']:.0f} ms per image including all four TTA views. The same "
         "exported graph is what we evaluated."],
        ["Keep <b>PyTorch</b> only for Grad-CAM", "Grad-CAM needs gradients, which ONNX Runtime does not provide. "
         "Grad-CAM adds several seconds on the free CPU, so the heatmap is computed after the grade."],
        ["<b>FastAPI</b> service on <b>Hugging Face Spaces</b> (Docker, free CPU Basic)", "16 GB RAM is enough for "
         "PyTorch; other free hosts (Render: 512 MB) are too small. Called only server-to-server by the web app "
         "with an API key."],
        ["Weights in a <b>private Hugging Face model repo</b>", "Weights (about 85 MB) never go into git; the Space "
         "downloads them at start-up with a read-only token scoped to that one repo."],
        ["Production refuses untrained models", "A random-weight pipeline-test model exists for development. With "
         "APP_ENV=production the service refuses to load it, so the live site can never show a fake prediction."],
        ["Images deleted after inference", "Photos go to a private bucket through a short-lived signed URL and are "
         "deleted right after scoring; only the result is stored."],
    ], [5.6 * cm, 11.4 * cm]),
    P("11. Generative AI: the patient report", "h1"),
    *bullets([
        "<b>Claude API</b> (Anthropic, model claude-opus-5-5) writes <b>only</b> a plain-language explanation "
        "paragraph in Urdu or English.",
        "<b>It never decides anything.</b> Grade, referral action, borderline note and disclaimer come from fixed "
        "bilingual templates. The model receives only the result plus age and years with diabetes, never names "
        "or IDs.",
        "<b>Its output is checked</b> (right language and script, length, no contradicting grade, no \"urgent\" for a "
        "routine case, no \"diagnosis\" claims). On any failure, timeout or missing key, a fixed template report is "
        "used. Today no API key is set, so reports come from the template.",
    ]),
    P("12. Safety rules built into the ML", "h1"),
    *bullets([
        "Wording is always \"screening / triage support\", never \"diagnosis\"; every result carries the disclaimer.",
        "Low-quality photos are rejected, not graded.",
        "Borderline scores are referred, never cleared.",
        "Confidence is capped at 95% and labelled not calibrated.",
        "Real numbers are reported even where they are below the benchmark (specificity).",
    ]),
    PageBreak(),
]

# 13. Q&A
qa = [
    ("Why EfficientNet-B3 and not a bigger or newer model?",
     "Best accuracy per parameter that we could train in our GPU budget and still run in under half a second on a "
     "free CPU. Bigger EfficientNets or ViTs need more data, more GPU hours and slower inference."),
    ("Why regression and not classification?",
     "DR grades are ordered. Regression punishes far-off mistakes more, matches the QWK metric, and lets us set the "
     "referral threshold on one score. It is the approach that won APTOS 2019."),
    ("Why dropout 0.3?",
     "Regularisation: it randomly hides 30% of features in training so the model cannot rely on a few and memorise "
     "33k images. 0.3 is the EfficientNet-B3 authors' value; we kept the tested default."),
    ("Why SmoothL1 loss?",
     "Precise for small errors, robust for large ones, so mislabelled images (DR graders often disagree by one "
     "grade) do not dominate training."),
    ("Why Ben Graham preprocessing?",
     "It removes uneven lighting and camera colour cast and makes small lesions stand out. It came from the 2015 "
     "Kaggle DR winner, and it makes images from different cameras look alike."),
    ("Why no colour augmentation?",
     "Lesion colour is diagnostic (red haemorrhages, yellow exudates); shifting hue could change the true label."),
    ("Did you tune on the test set?",
     "No threshold or model weight was fitted on IDRiD. But we chose to add EyePACS after seeing the APTOS-only "
     "model's IDRiD result, so IDRiD influenced the data choice. We disclose that; a new external set would remove it."),
    ("Your specificity is lower than IDx-DR. Is that a problem?",
     f"It is a deliberate trade-off: we miss {er['fn']} of {er['tp'] + er['fn']} referable eyes, at the cost of extra "
     "referrals. A false referral costs one visit; a miss can cost sight. In a pilot we would re-fit the threshold on "
     "local data to recover specificity."),
    ("Will it work on Pakistani patients?",
     "APTOS and IDRiD are both Indian, the closest public populations. No public Pakistani graded set exists. The "
     "next step is a pilot with a local eye hospital to validate and recalibrate."),
    ("How do you know the model looks at the right thing?",
     "Grad-CAM heatmaps on every result let a human check. A quantitative comparison with IDRiD lesion masks is the "
     "next step."),
    ("Why is the confidence not 100% even for clear cases?",
     "It is a heuristic capped at 95% on purpose. A screening tool should never claim certainty."),
    ("What happens with a bad photo?",
     "The quality gate rejects it with a specific reason (blurry, too dark, not a retina) and asks for a retake. It is "
     "never graded."),
    ("Does the LLM make medical decisions?",
     "No. It only rephrases the fixed result in simple Urdu or English, its output is checked, and a template is used "
     "if anything looks wrong."),
]
story += [P("13. Likely jury questions: short answers", "h1")]
for q, a in qa:
    story += [KeepTogether([P(q, "q"), P(a)])]

# Glossary
story += [
    Spacer(1, 0.3 * cm),
    KeepTogether([P("Glossary", "h1"), table([
        ["Term", "Plain meaning"],
        ["CNN", "Convolutional neural network: a deep-learning model that learns visual patterns with small sliding "
                "filters."],
        ["Transfer learning", "Starting from a model already trained on another large dataset (ImageNet)."],
        ["Epoch", "One full pass over the training images."],
        ["Overfitting", "Memorising the training images instead of learning patterns that generalise."],
        ["Regularisation", "Techniques (dropout, weight decay, augmentation) that reduce overfitting."],
        ["External test set", "Data from a different source, used only once at the end, to estimate real-world "
                              "performance."],
        ["ONNX", "A portable file format for trained models, run fast on CPU by onnxruntime."],
        ["NPDR", "Non-proliferative diabetic retinopathy (grades 1-3)."],
    ], [3.4 * cm, 13.6 * cm])]),
    Spacer(1, 0.3 * cm),
    P("Sources in the repository: ml/reports/metrics.json (all results), ml/runs/ (archived runs), DECISIONS.md "
      "(decision log), ml/src/nazarai_ml/ (code). Regenerate this PDF with scripts/make_ml_brief.py.", "small"),
]

OUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm,
                        bottomMargin=2 * cm, title="NazarAI ML technical brief", author="NazarAI team",
                        subject=f"Model {model['model_version']}")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"wrote {OUT}")
