"""PDF forensic report generator"""
from datetime import datetime, timezone
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

from aegis_core.config import Settings


def compile_forensic_dossier_pdf(stats: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    BLUE = colors.HexColor('#2563eb')
    RED  = colors.HexColor('#dc2626')
    SLATE = colors.HexColor('#475569')
    LIGHT = colors.HexColor('#f1f5f9')

    title_style = ParagraphStyle('ILFTitle', parent=styles['Heading1'], textColor=BLUE, fontSize=20, spaceAfter=4)
    h2_style    = ParagraphStyle('ILFH2',    parent=styles['Heading2'], textColor=BLUE, fontSize=13, spaceAfter=4, spaceBefore=12)
    normal_style = ParagraphStyle('ILFNormal', parent=styles['Normal'], textColor=SLATE, fontSize=9, leading=14)
    label_style  = ParagraphStyle('ILFLabel', parent=styles['Normal'], textColor=SLATE, fontSize=8, fontName='Helvetica-Bold')

    story = []

    # ── Cover ─────────────────────────────────────────────────────────
    story.append(Paragraph("INTELLIGENT LOG FORENSICS", title_style))
    story.append(Paragraph("Security Investigation Report", ParagraphStyle('sub', parent=styles['Normal'], fontSize=12, textColor=SLATE)))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=12))

    meta = [
        ['Generated:', Settings.now_display()],
        ['Platform:', f'{Settings.APP_NAME} v{Settings.APP_VERSION}'],
        ['Report Type:', 'Full Forensic Investigation'],
    ]
    if stats.get('file'):
        f = stats['file']
        meta += [
            ['File Analyzed:', f.get('filename','—')],
            ['File Size:', f'{(f.get("file_size",0)/1024):.1f} KB'],
            ['Records:', str(f.get('record_count',0))],
            ['Threats:', str(f.get('threat_count',0))],
        ]

    meta_tbl = Table([[Paragraph(k, label_style), Paragraph(v, normal_style)] for k,v in meta],
                     colWidths=[45*mm, 120*mm])
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), LIGHT),
        ('TEXTCOLOR', (0,0), (0,-1), SLATE),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 12))

    # ── Summary ───────────────────────────────────────────────────────
    story.append(Paragraph("Executive Summary", h2_style))
    story.append(Paragraph(
        f"This report documents the automated forensic analysis performed by {Settings.APP_NAME}. "
        f"The investigation identified {stats.get('total_threats',0)} threat signals across "
        f"{stats.get('total_files',0)} analyzed log file(s), resulting in "
        f"{stats.get('active_incidents',0)} active security incidents requiring investigation. "
        f"Critical severity events: {stats.get('critical_count',0)}. "
        f"Average threat score: {stats.get('avg_threat_score',0)}/100.",
        normal_style))
    story.append(Spacer(1, 8))

    # ── Severity Distribution ─────────────────────────────────────────
    sev_map = stats.get('severity_map', {})
    if sev_map:
        story.append(Paragraph("Severity Distribution", h2_style))
        sev_data = [['Severity', 'Count', 'Risk Level']]
        for sev, cnt in sev_map.items():
            sev_data.append([sev, str(cnt), 'Critical' if sev == 'Critical' else 'Elevated' if sev == 'High' else 'Moderate'])
        sev_tbl = Table(sev_data, colWidths=[50*mm, 40*mm, 60*mm])
        sev_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), BLUE),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(sev_tbl)
        story.append(Spacer(1, 8))

    # ── Threat Details ────────────────────────────────────────────────
    threats_detail = stats.get('threats_detail', [])
    if threats_detail:
        story.append(Paragraph("Top Threat Detections", h2_style))
        tbl_data = [['Severity', 'Score', 'Category', 'Technique', 'Finding']]
        for t in threats_detail[:20]:
            finding = str(t.get('finding',''))[:80]
            tbl_data.append([
                t.get('severity','—'), str(t.get('score','—')),
                str(t.get('category','—'))[:20], str(t.get('technique_id','—')),
                Paragraph(finding, ParagraphStyle('sm', parent=styles['Normal'], fontSize=7))
            ])
        threat_tbl = Table(tbl_data, colWidths=[20*mm, 15*mm, 35*mm, 18*mm, 72*mm])
        threat_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), RED),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (0,0), (-1,-1), 4), ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(threat_tbl)
        story.append(Spacer(1, 8))

    # ── Incidents ─────────────────────────────────────────────────────
    incidents = stats.get('recent_incidents', [])
    if incidents:
        story.append(Paragraph("Active Incidents", h2_style))
        inc_data = [['#', 'Title', 'Severity', 'Status', 'Created']]
        for inc in incidents:
            inc_data.append([
                str(inc.get('incident_id','')),
                Paragraph(str(inc.get('title',''))[:60], ParagraphStyle('sm', parent=styles['Normal'], fontSize=7)),
                inc.get('severity','—'), inc.get('status','—').title(),
                str(inc.get('created_at',''))[:10]
            ])
        inc_tbl = Table(inc_data, colWidths=[12*mm, 75*mm, 22*mm, 22*mm, 24*mm])
        inc_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), BLUE),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT]),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(inc_tbl)
        story.append(Spacer(1, 8))

    # ── Footer ────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width='100%', thickness=0.5, color=LIGHT))
    story.append(Paragraph(
        f"{Settings.APP_NAME} · Automated Forensic Report · {Settings.now_display()} · CONFIDENTIAL",
        ParagraphStyle('footer', parent=styles['Normal'], fontSize=7, textColor=colors.HexColor('#94a3b8'))
    ))

    doc.build(story)
    return buf.getvalue()


# Backward compat alias
produce_investigation_dossier = compile_forensic_dossier_pdf
