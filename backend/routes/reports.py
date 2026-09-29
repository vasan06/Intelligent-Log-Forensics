"""
routes/reports.py — ILF Report Generation

PDF report generation using ReportLab.

No classes.
No ORM usage.
No artificial database-wide report data.
"""

import datetime
import io

from flask import Blueprint, jsonify, request, send_file


reports_bp = Blueprint("reports", __name__)


# =========================================================
# PDF GENERATION
# =========================================================

def generate_pdf(title, sections):
    """
    Generate a PDF report using ReportLab.

    Returns:
        BytesIO | None
    """

    try:
        from reportlab.lib import colors
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import (
            ParagraphStyle,
            getSampleStyleSheet,
        )
        from reportlab.platypus import (
            HRFlowable,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

    except ImportError:
        return None

    buffer = io.BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=50,
        rightMargin=50,
        topMargin=60,
        bottomMargin=60,
    )

    styles = getSampleStyleSheet()

    brand = HexColor("#2D2B6B")
    muted = HexColor("#6B6880")
    body_color = HexColor("#3A3845")
    border = HexColor("#E4E2DE")
    alternate = HexColor("#F7F6F3")

    title_style = ParagraphStyle(
        "ILFReportTitle",
        parent=styles["Heading1"],
        textColor=brand,
        fontSize=22,
        spaceAfter=4,
    )

    heading_style = ParagraphStyle(
        "ILFReportHeading",
        parent=styles["Heading2"],
        textColor=brand,
        fontSize=13,
        spaceBefore=16,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        "ILFReportBody",
        parent=styles["Normal"],
        textColor=body_color,
        fontSize=10,
        spaceAfter=6,
    )

    meta_style = ParagraphStyle(
        "ILFReportMeta",
        parent=styles["Normal"],
        textColor=muted,
        fontSize=9,
    )

    story = [
        Paragraph(
            "Intelligent Log Forensic",
            title_style,
        ),
        Paragraph(
            title,
            ParagraphStyle(
                "ILFReportSubtitle",
                parent=styles["Heading2"],
                textColor=muted,
                fontSize=14,
                spaceAfter=2,
            ),
        ),
        Paragraph(
            (
                "Generated: "
                f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC"
            ),
            meta_style,
        ),
        HRFlowable(
            width="100%",
            thickness=2,
            color=brand,
            spaceAfter=18,
        ),
    ]

    for section in sections:
        story.append(
            Paragraph(
                section.get("heading", ""),
                heading_style,
            )
        )

        body = section.get("body", "")

        story.append(
            Paragraph(
                body.replace("\n", "<br/>"),
                body_style,
            )
        )

        table_data = section.get("table")

        if table_data:
            table = Table(
                table_data.get("rows", []),
                colWidths=table_data.get("widths"),
            )

            table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (-1, 0),
                            brand,
                        ),
                        (
                            "TEXTCOLOR",
                            (0, 0),
                            (-1, 0),
                            colors.white,
                        ),
                        (
                            "FONTSIZE",
                            (0, 0),
                            (-1, 0),
                            9,
                        ),
                        (
                            "FONTSIZE",
                            (0, 1),
                            (-1, -1),
                            8,
                        ),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [alternate, colors.white],
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            border,
                        ),
                        (
                            "TOPPADDING",
                            (0, 0),
                            (-1, -1),
                            5,
                        ),
                        (
                            "BOTTOMPADDING",
                            (0, 0),
                            (-1, -1),
                            5,
                        ),
                    ]
                )
            )

            story.append(table)

        story.append(Spacer(1, 8))

    document.build(story)

    buffer.seek(0)

    return buffer


# =========================================================
# REPORT INPUT
# =========================================================

def build_report_sections(data):
    """
    Build report sections from supplied analysis data.

    No random values are generated here.
    """

    report_type = data.get("type", "overall")
    source = data.get("source", "All Sources")
    time_range = data.get("time_range", "Last 24h")

    summary = data.get("summary", {})

    total_logs = summary.get("total_logs", 0)
    anomalies = summary.get("anomalies", 0)
    anomaly_score = summary.get("anomaly_score", 0)
    risk_level = summary.get("risk_level", "UNKNOWN")

    sections = [
        {
            "heading": "Executive Summary",
            "body": (
                f"Analysis of {source} over {time_range}. "
                f"Total logs processed: {total_logs:,}. "
                f"Anomalies detected: {anomalies:,}. "
                f"Anomaly score: {anomaly_score}. "
                f"Risk level: {risk_level}. "
                f"Report type: {report_type}."
            ),
        }
    ]

    severity = data.get("severity", {})

    if severity:
        sections.append(
            {
                "heading": "Log Volume Breakdown",
                "body": "Severity distribution for the user's analysed logs.",
                "table": {
                    "rows": [
                        ["Severity", "Count"],
                        [
                            "INFO",
                            str(severity.get("INFO", 0)),
                        ],
                        [
                            "WARN",
                            str(severity.get("WARN", 0)),
                        ],
                        [
                            "ERROR",
                            str(severity.get("ERROR", 0)),
                        ],
                        [
                            "CRITICAL",
                            str(severity.get("CRITICAL", 0)),
                        ],
                        [
                            "DEBUG",
                            str(severity.get("DEBUG", 0)),
                        ],
                    ],
                    "widths": [180, 120],
                },
            }
        )

    ml_results = data.get("ml_results")

    if ml_results:
        rows = [
            [
                "Algorithm",
                "Score",
                "Confidence",
            ]
        ]

        for result in ml_results:
            rows.append(
                [
                    str(result.get("algorithm", "")),
                    str(result.get("score", 0)),
                    str(result.get("confidence", 0)),
                ]
            )

        sections.append(
            {
                "heading": "ML Analysis",
                "body": "Machine-learning analysis results for the user's data.",
                "table": {
                    "rows": rows,
                    "widths": [180, 100, 100],
                },
            }
        )

    mitre_results = data.get("mitre_results")

    if mitre_results:
        rows = [
            [
                "Technique ID",
                "Name",
                "Tactic",
                "Matches",
            ]
        ]

        for result in mitre_results:
            rows.append(
                [
                    str(result.get("technique_id", "")),
                    str(result.get("name", "")),
                    str(result.get("tactic", "")),
                    str(result.get("matches", 0)),
                ]
            )

        sections.append(
            {
                "heading": "MITRE ATT&CK Mappings",
                "body": "MITRE ATT&CK mappings associated with the user's analysed data.",
                "table": {
                    "rows": rows,
                    "widths": [90, 160, 120, 60],
                },
            }
        )

    recommendations = data.get("recommendations")

    if recommendations:
        sections.append(
            {
                "heading": "Recommendations",
                "body": "\n".join(
                    str(item)
                    for item in recommendations
                ),
            }
        )

    return sections


# =========================================================
# REPORT TITLE
# =========================================================

def get_report_title(report_type):
    """
    Return the human-readable report title.
    """

    titles = {
        "overall": "Overall System Report",
        "file": "Log File Analysis Report",
        "simulation": "Simulation Analysis Report",
    }

    return titles.get(
        report_type,
        "Log Forensics Report",
    )


# =========================================================
# GENERATE REPORT
# =========================================================

@reports_bp.route(
    "/reports/generate",
    methods=["POST"],
)
def generate():
    data = request.get_json(silent=True) or {}

    report_type = data.get(
        "type",
        "overall",
    )

    sections = build_report_sections(data)

    title = get_report_title(
        report_type
    )

    pdf = generate_pdf(
        title,
        sections,
    )

    if pdf is None:
        return jsonify(
            {
                "success": False,
                "message": "ReportLab is not installed",
            }
        ), 500

    timestamp = datetime.datetime.now(
        datetime.timezone.utc
    ).strftime("%Y%m%d_%H%M")

    return send_file(
        pdf,
        as_attachment=True,
        download_name=f"ILF_Report_{timestamp}.pdf",
        mimetype="application/pdf",
    )


# =========================================================
# REPORT HISTORY
# =========================================================

@reports_bp.route(
    "/reports/history",
    methods=["GET"],
)
def history():
    """
    Report history will be populated from the authenticated
    user's reports only.

    Database querying is intentionally kept out of this file
    until the Core-based database layer is completed.
    """

    return jsonify(
        {
            "success": True,
            "reports": [],
        }
    ), 200