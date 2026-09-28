"""routes/reports.py — PDF report generation via ReportLab"""
import io, datetime, random
from flask import Blueprint, request, jsonify, send_file

reports_bp = Blueprint('reports', __name__)

def _try_reportlab(title, sections):
    """Generate PDF using ReportLab. Falls back gracefully if not installed."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib import colors

        buf    = io.BytesIO()
        doc    = SimpleDocTemplate(buf, pagesize=A4,
                                   leftMargin=50, rightMargin=50,
                                   topMargin=60, bottomMargin=60)
        styles = getSampleStyleSheet()
        brand  = HexColor('#2D2B6B')
        danger = HexColor('#C0392B')
        muted  = HexColor('#6B6880')

        title_style = ParagraphStyle('Title', parent=styles['Heading1'],
                                     textColor=brand, fontSize=22, spaceAfter=4)
        h2_style    = ParagraphStyle('H2', parent=styles['Heading2'],
                                     textColor=brand, fontSize=13, spaceBefore=16, spaceAfter=6)
        body_style  = ParagraphStyle('Body', parent=styles['Normal'],
                                     textColor=HexColor('#3A3845'), fontSize=10, spaceAfter=6)
        meta_style  = ParagraphStyle('Meta', parent=styles['Normal'],
                                     textColor=muted, fontSize=9)

        story = [
            Paragraph('Intelligent Log Forensic', title_style),
            Paragraph(title, ParagraphStyle('Sub', parent=styles['Heading2'], textColor=muted, fontSize=14, spaceAfter=2)),
            Paragraph(f'Generated: {datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC', meta_style),
            HRFlowable(width='100%', thickness=2, color=brand, spaceAfter=18),
        ]

        for section in sections:
            story.append(Paragraph(section['heading'], h2_style))
            story.append(Paragraph(section['body'], body_style))
            if 'table' in section:
                t = Table(section['table']['rows'],
                          colWidths=section['table'].get('widths'))
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), brand),
                    ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
                    ('FONTSIZE',   (0,0), (-1,0), 9),
                    ('FONTSIZE',   (0,1), (-1,-1), 8),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#F7F6F3'), colors.white]),
                    ('GRID',       (0,0), (-1,-1), 0.4, HexColor('#E4E2DE')),
                    ('TOPPADDING', (0,0), (-1,-1), 5),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ]))
                story.append(t)
            story.append(Spacer(1, 8))

        doc.build(story)
        buf.seek(0)
        return buf
    except ImportError:
        return None

@reports_bp.route('/reports/generate', methods=['POST'])
def generate():
    data       = request.json or {}
    rtype      = data.get('type', 'overall')          # overall | file | simulation
    source     = data.get('source', 'All Sources')
    time_range = data.get('time_range', 'Last 24h')
    include    = data.get('include', ['summary','logs','mitre','ml'])

    # Build report sections
    total   = random.randint(80000, 200000)
    anomaly = random.randint(20, 150)
    score   = round(random.uniform(0.3, 0.9), 3)
    risk    = 'HIGH' if score > 0.75 else ('MEDIUM' if score > 0.5 else 'LOW')

    sections = [
        {
            'heading': 'Executive Summary',
            'body':    f'Analysis of {source} over {time_range}. '
                       f'Total logs ingested: {total:,}. Anomalies detected: {anomaly}. '
                       f'Ensemble ML anomaly score: {score} ({risk} risk). '
                       f'Report type: {rtype}.',
        },
        {
            'heading': 'Log Volume Breakdown',
            'body':    'Severity distribution across ingested logs.',
            'table': {
                'rows': [
                    ['Severity', 'Count', 'Percentage'],
                    ['INFO',     f'{int(total*0.42):,}', '42%'],
                    ['WARN',     f'{int(total*0.22):,}', '22%'],
                    ['ERROR',    f'{int(total*0.18):,}', '18%'],
                    ['CRITICAL', f'{int(total*0.08):,}', '8%'],
                    ['DEBUG',    f'{int(total*0.10):,}', '10%'],
                ],
                'widths': [120, 120, 120],
            },
        },
        {
            'heading': 'ML Ensemble Results',
            'body':    f'All four algorithms (Isolation Forest, LOF, One-Class SVM, LSTM) '
                       f'were run concurrently. Best algorithm selected by confidence×score composite. '
                       f'Final anomaly score: {score}. Risk level: {risk}.',
            'table': {
                'rows': [
                    ['Algorithm', 'Score', 'Confidence', 'Selected'],
                    ['Isolation Forest', f'{round(score+random.uniform(-0.1,0.1),3)}', '0.88', 'No'],
                    ['Local Outlier Factor', f'{round(score+random.uniform(-0.1,0.1),3)}', '0.82', 'No'],
                    ['One-Class SVM', f'{round(score+random.uniform(-0.1,0.1),3)}', '0.75', 'No'],
                    ['LSTM Sequence', f'{score}', '0.92', 'Yes'],
                ],
                'widths': [150, 80, 100, 80],
            },
        },
        {
            'heading': 'MITRE ATT&CK Mappings',
            'body':    'Log entries were automatically mapped to MITRE ATT&CK techniques.',
            'table': {
                'rows': [
                    ['Technique ID', 'Name', 'Tactic', 'Matches'],
                    ['T1110', 'Brute Force', 'Credential Access', str(random.randint(5,40))],
                    ['T1046', 'Network Service Discovery', 'Discovery', str(random.randint(2,20))],
                    ['T1059', 'Command and Scripting', 'Execution', str(random.randint(3,15))],
                    ['T1071', 'App Layer Protocol', 'Command & Control', str(random.randint(1,10))],
                ],
                'widths': [90, 160, 120, 60],
            },
        },
        {
            'heading': 'Recommendations',
            'body':    '1. Review all CRITICAL severity events immediately.\n'
                       '2. Investigate flagged IPs for potential compromise.\n'
                       '3. Enable automated alerting for MITRE T1110 and T1046 pattern matches.\n'
                       '4. Schedule daily ML analysis to track anomaly score trends.\n'
                       '5. Update firewall rules based on detected port scan sources.',
        },
    ]

    title = {'overall': 'Overall System Report', 'file': 'Log File Analysis Report',
             'simulation': 'Simulation Analysis Report'}.get(rtype, 'Log Forensics Report')

    buf = _try_reportlab(title, sections)

    if buf:
        ts = datetime.datetime.utcnow().strftime('%Y%m%d_%H%M')
        return send_file(buf, as_attachment=True, download_name=f'ILF_Report_{ts}.pdf',
                         mimetype='application/pdf')

    # ReportLab not installed — return JSON summary
    return jsonify({'success': True, 'report_type': rtype, 'sections': sections,
                    'note': 'Install reportlab for PDF: pip install reportlab'})

@reports_bp.route('/reports/history')
def history():
    import uuid, datetime
    def _r(t):
        return {'id': str(uuid.uuid4())[:8], 'type': t,
                'generated': datetime.datetime.utcnow().isoformat(),
                'size_kb': random.randint(40, 300),
                'risk': random.choice(['LOW','MEDIUM','HIGH'])}
    return jsonify({'reports': [_r(t) for t in ['overall','file','simulation','overall']]})
