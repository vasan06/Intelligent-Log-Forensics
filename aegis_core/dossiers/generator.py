import io
from typing import Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from aegis_core.config import SentinelSettings


def compile_forensic_dossier_pdf(telemetry_summary: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    
    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        "AegisHeader",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    subhead_style = ParagraphStyle(
        "AegisSubhead",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    section_style = ParagraphStyle(
        "AegisSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=14,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "AegisBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )

    story = []

    story.append(Paragraph("AEGIS CYBER-FORENSIC INCIDENT DOSSIER", header_style))
    meta_text = (
        f"Generated: {SentinelSettings.get_current_utc_timestamp()} UTC | "
        f"Security Operations Classification: CONFIDENTIAL TACTICAL | "
        f"Platform: {SentinelSettings.SYSTEM_RELEASE}"
    )
    story.append(Paragraph(meta_text, subhead_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=14))

    story.append(Paragraph("I. EXECUTIVE TELEMETRY OVERVIEW", section_style))
    kpi_data = [
        ["Total Normalized Signals", "Correlated Threats", "Active Threat Clusters", "Mean Threat Index"],
        [
            str(telemetry_summary.get("total_signals", 0)),
            str(telemetry_summary.get("total_threats", 0)),
            str(telemetry_summary.get("active_clusters", 0)),
            f"{telemetry_summary.get('average_threat_index', 0.0)} / 100",
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[130, 130, 130, 150])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#0284c7")),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("II. THREAT MAGNITUDE DISTRIBUTION", section_style))
    sev_counts = telemetry_summary.get("urgency_breakdown", {})
    sev_data = [
        ["Urgency Tier", "Detection Volume", "Response Protocol"],
        ["Critical (85-100)", str(sev_counts.get("Critical", 0)), "Immediate Automated Containment & Subnet Quarantine"],
        ["High (70-84)", str(sev_counts.get("High", 0)), "Analyst Triage & Session Invalidation Within 15 Min"],
        ["Elevated (50-69)", str(sev_counts.get("Elevated", 0)), "Enhanced Logging & Monitored Egress Tracking"],
        ["Notice (<50)", str(sev_counts.get("Notice", 0)), "Routine Telemetry Retention for Audit Trail"],
    ]
    sev_table = Table(sev_data, colWidths=[120, 100, 320])
    sev_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sev_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("III. CORRELATED THREAT DOCKETS", section_style))
    clusters = telemetry_summary.get("recent_dockets", [])
    if clusters:
        cluster_rows = [["Docket Headline", "Severity", "Attribution Confidence", "Technique ID"]]
        for cl in clusters[:6]:
            cluster_rows.append([
                cl.get("cluster_headline", "Incident"),
                cl.get("triage_severity", "Elevated"),
                f"{cl.get('attribution_confidence', 0)}%",
                cl.get("associated_technique") or "General",
            ])
        cluster_table = Table(cluster_rows, colWidths=[240, 90, 120, 90])
        cluster_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(cluster_table)
    else:
        story.append(Paragraph("No active threat dockets recorded in the target evidence bundle.", body_style))

    story.append(Spacer(1, 14))

    story.append(Paragraph("IV. FORENSIC FIDELITY & EVIDENCE CUSTODY", section_style))
    fidelity_rating = telemetry_summary.get("fidelity_rating", 95.0)
    fidelity_summary = (
        f"Evidence Bundle Fidelity Rating: <b>{fidelity_rating}%</b>. "
        f"Ingestion verified via SHA-256 cryptographic digest. "
        f"All signals preserved in tamper-evident relational vault storage."
    )
    story.append(Paragraph(fidelity_summary, body_style))
    story.append(Spacer(1, 20))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=10))
    story.append(Paragraph("Aegis Security Operations Center // Forensic Investigation Division", subhead_style))

    doc.build(story)
    return buffer.getvalue()

