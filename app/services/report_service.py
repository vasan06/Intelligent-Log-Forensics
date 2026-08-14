from pathlib import Path

from flask import current_app
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.repositories import report_repository


def generate_report(upload, user_id):
    report_name = f"forensic-report-{upload.id}.pdf"
    path = (Path(current_app.config["REPORT_FOLDER"]) / report_name).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Intelligent Log Forensics Report", styles["Title"]),
        Paragraph(f"Source file: {upload.file_name}", styles["Normal"]),
        Spacer(1, 8),
    ]
    quality = upload.quality
    story.append(
        Table(
            [
                ["Metric", "Value"],
                ["Logs analyzed", upload.total_records],
                ["Data quality score", f"{quality.quality_score:.1f}/100" if quality else "N/A"],
                ["Application health score", f"{quality.health_score:.1f}/100" if quality else "N/A"],
                ["Risk events", len(upload.risks)],
                ["Incidents", len(upload.incidents)],
            ],
            colWidths=[75 * mm, 75 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16222c")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5db")),
                    ("PADDING", (0, 0), (-1, -1), 7),
                ]
            ),
        )
    )
    prioritized = sorted(
        (risk for risk in upload.risks if risk.risk_score >= 60),
        key=lambda item: item.risk_score,
        reverse=True,
    )[:25]
    story.extend([Spacer(1, 14), Paragraph("Immediate & High-Priority Findings", styles["Heading2"])])
    story.append(Paragraph("This operational report intentionally includes only High and Critical findings (score 60+), limited to the top 25 by risk. Lower-priority evidence remains available in the application.", styles["BodyText"]))
    story.append(Spacer(1, 8))
    for risk in prioritized:
        mapping = risk.mitre_mapping
        detail = f"<b>{risk.severity} - {risk.risk_category} ({risk.risk_score:.0f})</b><br/>{risk.reason}"
        if mapping:
            detail += f"<br/>MITRE ATT&CK: {mapping.tactic} / {mapping.technique_id} {mapping.technique_name}"
        detail += f"<br/><i>Suggested action:</i> {risk.recommendation}"
        story.extend([Paragraph(detail, styles["BodyText"]), Spacer(1, 8)])
    if not prioritized:
        story.append(Paragraph("No High or Critical risk events were detected.", styles["BodyText"]))
    doc.build(story)

    return report_repository.create(upload.id, report_name, str(path), user_id)


def resolve_report_path(report_path):
    path = Path(report_path)
    if not path.is_absolute():
        path = Path(current_app.root_path).parent / path
    return path.resolve()
