from datetime import datetime
from pathlib import Path

from flask import current_app
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from app.models import Entity
from app.repositories import report_repository
from app.services.trust_score import for_file as trust_score_for_file

# Colour constants
DARK = colors.HexColor("#0d1117")
SURFACE = colors.HexColor("#161b22")
ACCENT = colors.HexColor("#388bfd")
CRITICAL = colors.HexColor("#f85149")
HIGH = colors.HexColor("#ff7b72")
MEDIUM = colors.HexColor("#e3b341")
LOW = colors.HexColor("#58a6ff")
OK = colors.HexColor("#3fb950")
TEXT = colors.HexColor("#c9d1d9")
MUTED = colors.HexColor("#8b949e")
BORDER = colors.HexColor("#30363d")
MITRE = colors.HexColor("#bc8cff")
WHITE = colors.white


def _styles():
    base = getSampleStyleSheet()

    def s(name, **kw) -> ParagraphStyle:
        parent = base["Normal"]
        return ParagraphStyle(name, parent=parent, textColor=TEXT, **kw)

    return {
        "title": s("RTitle", fontSize=22, textColor=WHITE, spaceAfter=4, fontName="Helvetica-Bold"),
        "subtitle": s("RSub", fontSize=10, textColor=MUTED, spaceAfter=16),
        "h2": s("RH2", fontSize=14, textColor=WHITE, spaceBefore=18, spaceAfter=8, fontName="Helvetica-Bold"),
        "h3": s("RH3", fontSize=11, textColor=ACCENT, spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold"),
        "body": s("RBody", fontSize=9, textColor=TEXT, spaceAfter=4, leading=14),
        "mono": s("RMono", fontSize=8, textColor=MUTED, fontName="Courier", leading=11),
        "label": s("RLabel", fontSize=7, textColor=MUTED, fontName="Helvetica-Bold"),
        "critical": s("RCrit", fontSize=9, textColor=CRITICAL),
        "high": s("RHigh", fontSize=9, textColor=HIGH),
        "medium": s("RMedium", fontSize=9, textColor=MEDIUM),
        "low": s("RLow", fontSize=9, textColor=LOW),
        "ok": s("ROk", fontSize=9, textColor=OK),
    }


def _sev_color(severity: str) -> object:
    s = (severity or "").lower()
    return {
        "critical": CRITICAL, "high": HIGH, "medium": MEDIUM, "low": LOW,
    }.get(s, TEXT)


def _table_style(header_col=SURFACE):
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_col),
        ("TEXTCOLOR",  (0, 0), (-1, 0), MUTED),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 7),
        ("ALIGN",      (0, 0), (-1, 0), "LEFT"),
        ("GRID",       (0, 0), (-1, -1), 0.3, BORDER),
        ("BACKGROUND", (0, 1), (-1, -1), DARK),
        ("TEXTCOLOR",  (0, 1), (-1, -1), TEXT),
        ("FONTSIZE",   (0, 1), (-1, -1), 8),
        ("PADDING",    (0, 0), (-1, -1), 6),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [DARK, SURFACE]),
    ])


def generate_report(upload, user_id):
    st = _styles()
    report_name = f"forensic-report-{upload.id}.pdf"
    path = (Path(current_app.config["REPORT_FOLDER"]) / report_name).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=20 * mm, bottomMargin=18 * mm,
    )

    story = []

    # ── Header ───────────────────────────────────────────────
    story.append(Paragraph("Intelligent Log Forensics", st["title"]))
    story.append(Paragraph("Forensic Evidence Report", st["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=12))

    # ── Evidence summary table ────────────────────────────────
    story.append(Paragraph("Evidence Overview", st["h2"]))
    quality = upload.quality
    trust_raw = getattr(upload, "forensic_trust", None) or trust_score_for_file(upload.id)
    trust = Entity(trust_raw) if isinstance(trust_raw, dict) else trust_raw

    summary_data = [
        ["Field", "Value"],
        ["File name",          upload.file_name],
        ["Content hash (SHA-256)", upload.content_hash or "N/A"],
        ["Upload time",        str(upload.upload_time or "N/A")],
        ["Processing status",  upload.processing_status],
        ["Total log records",  f"{upload.total_records:,}"],
        ["Valid records",      f"{upload.valid_records:,}"],
        ["Risk events flagged", f"{len(upload.risks):,}"],
        ["Correlated incidents", f"{len(upload.incidents):,}"],
    ]

    story.append(Table(
        summary_data,
        colWidths=[65 * mm, 105 * mm],
        style=_table_style(),
    ))

    # ── Quality & trust ───────────────────────────────────────
    story.append(Paragraph("Quality & Forensic Trust Metrics", st["h2"]))

    quality_data = [
        ["Metric", "Score", "Interpretation"],
        ["Data quality score",    f"{quality.quality_score:.1f}/100"  if quality else "N/A",
                                   _quality_label(quality.quality_score if quality else None)],
        ["Application health",    f"{quality.health_score:.1f}/100"   if quality else "N/A",
                                   _quality_label(quality.health_score if quality else None)],
        ["Forensic trust score",  f"{trust.score:.1f}/100"            if trust else "N/A",
                                   _quality_label(trust.score if trust else None)],
        ["Rule/ML agreement",     f"{trust.agreement_rate:.0f}%"      if trust else "N/A", ""],
        ["Risk coverage rate",    f"{trust.coverage_rate:.0f}%"       if trust else "N/A", ""],
        ["MITRE ATT&CK mapping",  f"{trust.mitre_coverage_rate:.0f}%" if trust else "N/A", ""],
        ["Duplicate log entries", f"{quality.duplicate_logs}"         if quality else "N/A", ""],
    ]
    if trust:
        quality_data.append(["Trust formula", trust.formula, ""])

    story.append(Table(
        quality_data,
        colWidths=[65 * mm, 45 * mm, 60 * mm],
        style=_table_style(),
    ))

    # ── Incidents ─────────────────────────────────────────────
    incidents = upload.incidents or []
    if incidents:
        story.append(Paragraph(f"Correlated Incidents ({len(incidents)})", st["h2"]))
        for inc in incidents:
            story.append(Paragraph(f"{inc.severity.upper()} — {inc.title}  [score: {inc.score:.1f}]", st["h3"]))
            if inc.summary:
                story.append(Paragraph(inc.summary, st["body"]))
            timeline_rows = [["Time", "Event type", "Description", "MITRE tactic"]]
            for ev in (inc.events or []):
                timeline_rows.append([
                    str(ev.event_time)[:19] if ev.event_time else "—",
                    ev.event_type or "—",
                    ev.description or "—",
                    ev.mitre_tactic or "—",
                ])
            if len(timeline_rows) > 1:
                story.append(Table(
                    timeline_rows,
                    colWidths=[30 * mm, 28 * mm, 80 * mm, 32 * mm],
                    style=_table_style(),
                ))
            story.append(Spacer(1, 8))

    # ── High/Critical findings ────────────────────────────────
    prioritized = sorted(
        (r for r in (upload.risks or []) if r.risk_score >= 60),
        key=lambda r: r.risk_score, reverse=True,
    )[:25]

    story.append(Paragraph(
        f"High & Critical Findings — Top {min(len(prioritized), 25)} by Risk Score",
        st["h2"],
    ))
    story.append(Paragraph(
        "Includes only findings scored ≥60 (High or Critical). Lower-severity evidence is available in the console.",
        st["body"],
    ))
    story.append(Spacer(1, 6))

    if prioritized:
        risks_data = [["Sev", "Score", "Category", "MITRE", "Finding summary", "Recommended action"]]
        for risk in prioritized:
            mitre = risk.mitre_mapping
            mitre_cell = f"{mitre.technique_id}\n{mitre.tactic}" if mitre else "—"
            risks_data.append([
                risk.severity,
                f"{risk.risk_score:.0f}",
                risk.risk_category,
                mitre_cell,
                (risk.reason or "")[:200],
                (risk.recommendation or "")[:160],
            ])
        story.append(Table(
            risks_data,
            colWidths=[14 * mm, 14 * mm, 28 * mm, 24 * mm, 56 * mm, 34 * mm],
            style=_table_style(),
        ))
    else:
        story.append(Paragraph("No High or Critical risk events were detected in this evidence set.", st["body"]))

    # ── Footer ────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.3, color=BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} · "
        f"Evidence ID: #{upload.id} · "
        f"Analyst user ID: {user_id}",
        st["mono"],
    ))

    doc.build(story)
    return report_repository.create(upload.id, report_name, str(path), user_id)


def _quality_label(score) -> str:
    if score is None:
        return ""
    if score >= 80:
        return "Good"
    if score >= 60:
        return "Fair"
    return "Poor"


def resolve_report_path(report_path):
    path = Path(report_path)
    if not path.is_absolute():
        path = Path(current_app.root_path).parent / path
    return path.resolve()
