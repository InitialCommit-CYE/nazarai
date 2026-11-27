"""PDF referral slip (ReportLab). Urdu is shaped with arabic-reshaper + python-bidi and rendered
in Noto Naskh Arabic (SIL OFL), because ReportLab cannot shape Nastaliq."""
from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .schemas import PdfRequest

FONT_DIR = Path(__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("NotoNaskh", str(FONT_DIR / "NotoNaskhArabic-Regular.ttf")))
pdfmetrics.registerFont(TTFont("NotoNaskh-Bold", str(FONT_DIR / "NotoNaskhArabic-Bold.ttf")))

TEAL = colors.HexColor("#0F766E")
URGENCY = {
    "routine": ("No referable DR - rescreen in 12 months", "قابلِ ریفرل ذیابیطس ریٹینوپیتھی نہیں ملی - 12 ماہ بعد دوبارہ معائنہ", colors.HexColor("#15803D")),
    "refer": ("Refer to an eye specialist", "آنکھوں کے ماہر ڈاکٹر کے پاس بھیجیں", colors.HexColor("#B45309")),
    "urgent": ("Refer URGENTLY to an eye specialist", "فوری طور پر آنکھوں کے ماہر ڈاکٹر کے پاس بھیجیں", colors.HexColor("#B91C1C")),
}
DISCLAIMER_EN = ("This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for "
                 "confirmation and treatment.")
DISCLAIMER_UR = "یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔"


URDU_WIDTH = 168 * mm


def confidence_text(c: float) -> str:
    """Words, not a percentage: the value is a heuristic. Matches frontend lib/clinical.ts confidenceLevel."""
    if c >= 0.75:
        return "High"
    if c >= 0.5:
        return "Moderate"
    return "Low - flipped views of the image gave different readings; specialist review of the photo advised"


def urdu(text: str, font: str = "NotoNaskh", size: float = 11, width: float = URDU_WIDTH) -> str:
    """Shape + reorder Urdu for PDF drawing.

    Lines are wrapped on the LOGICAL text (measured after shaping) before bidi reordering;
    letting ReportLab wrap the already-reordered string would reverse the order of the lines.
    """
    out: list[str] = []
    for para in text.split("\n"):
        line: list[str] = []
        for word in para.split():
            trial = " ".join(line + [word])
            if line and pdfmetrics.stringWidth(arabic_reshaper.reshape(trial), font, size) > width:
                out.append(" ".join(line))
                line = [word]
            else:
                line.append(word)
        out.append(" ".join(line))
    return "<br/>".join(escape(get_display(arabic_reshaper.reshape(l))) for l in out)


def _styles():
    return {
        "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, textColor=TEAL, leading=22),
        "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#475569")),
        "h": ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11, leading=15, spaceBefore=6),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=14, alignment=TA_LEFT),
        "ur": ParagraphStyle("ur", fontName="NotoNaskh", fontSize=11, leading=22, alignment=TA_RIGHT),
        "ur_h": ParagraphStyle("ur_h", fontName="NotoNaskh-Bold", fontSize=12, leading=22, alignment=TA_RIGHT),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#475569")),
    }


def build_referral_pdf(req: PdfRequest) -> bytes:
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=16 * mm, title=f"NazarAI referral slip {req.screening_id[:8]}",
                            author="NazarAI screening support")
    en_action, ur_action, colour = URGENCY[req.urgency]
    story = [
        Paragraph("NazarAI - Diabetic Retinopathy Screening Slip", s["title"]),
        Paragraph("AI screening / triage support. Not a diagnosis.", s["sub"]),
        Spacer(1, 6 * mm),
    ]
    if req.is_development_model:
        story += [Paragraph("<b>DEVELOPMENT MODEL - NOT A VALID SCREENING RESULT</b>",
                            ParagraphStyle("warn", parent=s["body"], textColor=colors.red)), Spacer(1, 3 * mm)]

    try:
        when = datetime.fromisoformat(req.created_at.replace("Z", "+00:00")).strftime("%d %b %Y, %H:%M UTC")
    except ValueError:
        when = req.created_at
    rows = [
        ["Screening ID", req.screening_id],
        ["Date", when],
        ["Patient reference (demo)", req.demo_patient_code or "-"],
        ["Age", str(req.age) if req.age is not None else "-"],
        ["Years with diabetes", str(req.diabetes_duration_years) if req.diabetes_duration_years is not None else "-"],
        ["AI-estimated DR grade", f"{req.grade} - {req.grade_label}"],
        ["Model confidence (heuristic)", confidence_text(req.confidence)],
        ["Referable DR", "Yes" if req.referable else "No"],
        ["Model version", req.model_version],
    ]
    t = Table([[Paragraph(f"<b>{escape(a)}</b>", s["body"]), Paragraph(escape(b), s["body"])] for a, b in rows],
              colWidths=[60 * mm, 112 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story += [t, Spacer(1, 5 * mm)]

    action = Table([[Paragraph(f"<b>{escape(en_action)}</b>", ParagraphStyle("a", parent=s["body"], textColor=colors.white, fontSize=12, leading=16))],
                    [Paragraph(urdu(ur_action, "NotoNaskh-Bold", 12), ParagraphStyle("au", parent=s["ur_h"], textColor=colors.white))]],
                   colWidths=[172 * mm])
    action.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colour), ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [action, Spacer(1, 5 * mm)]

    if req.report_text.strip():
        if req.language == "ur":
            story += [Paragraph(urdu("مریض کے لیے وضاحت", "NotoNaskh-Bold", 12), s["ur_h"]),
                      Paragraph(urdu(req.report_text.strip()), s["ur"])]
        else:
            story += [Paragraph("Explanation for the patient", s["h"]),
                      Paragraph(escape(req.report_text.strip()).replace("\n", "<br/>"), s["body"])]
        story.append(Spacer(1, 5 * mm))

    story += [
        Paragraph("Disclaimer", s["h"]),
        Paragraph(escape(DISCLAIMER_EN), s["body"]),
        Paragraph(urdu(DISCLAIMER_UR), s["ur"]),
        Spacer(1, 6 * mm),
        Paragraph("Specialist use: please confirm the grade clinically. NazarAI grades on the International Clinical "
                  "DR scale (0-4); referable DR = grade 2 or worse. Generated by the NazarAI screening-support "
                  "prototype (Capital Youth Expo Hackathon 2026). Demo data only.", s["small"]),
    ]
    doc.build(story)
    return buf.getvalue()
