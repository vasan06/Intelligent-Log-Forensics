/**
 * INTELLIGENT LOG FORENSIC - LIVE FEED TABLE HANDLER
 * Renders real-time incoming log events with red critical flash and smooth DOM virtual capping
 */

class LiveFeedTable {
  constructor(tableBodyId, maxRows = 40) {
    this.tableBody = document.getElementById(tableBodyId);
    this.maxRows = maxRows;
    this.init();
  }

  init() {
    if (!this.tableBody) return;

    // Hydrate from AppState recent logs if available
    if (window.appState && window.appState.state.recentLogs.length > 0) {
      window.appState.state.recentLogs.slice(0, 20).forEach(log => {
        this.renderRow(log, false);
      });
    }

    // Subscribe to new log events
    if (window.eventBus) {
      window.eventBus.on('log:added', (log) => {
        this.renderRow(log, true);
      });
    }
  }

  renderRow(log, animate = true) {
    if (!this.tableBody) return;

    const row = document.createElement('tr');
    if (animate) {
      row.classList.add('animate-slide-in');
    }

    if (log.severity === 'critical') {
      row.classList.add('flash-critical');
    }

    const sevBadge = this.getSeverityBadge(log.severity);
    const timeFormatted = new Date(log.timestamp).toLocaleTimeString();

    row.innerHTML = `
      <td class="forensic-mono">${timeFormatted}</td>
      <td class="forensic-mono" style="color: #67E8F9;">${this.escape(log.source_ip)}</td>
      <td><span class="badge ${sevBadge.class}">${sevBadge.label}</span></td>
      <td class="forensic-mono">${this.escape(log.mitre_technique || 'N/A')}</td>
      <td class="forensic-mono" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(log.payload_snippet || log.raw_message || '')}">
        <span style="color: #A5B4FC; font-weight: 600;">${this.escape(log.method || 'GET')}</span> ${this.escape(log.target || '/')} — ${this.escape(log.payload_snippet || '')}
      </td>
      <td class="forensic-mono" style="font-weight: 600; color: ${log.confidence_score >= 80 ? '#EF4444' : '#38BDF8'};">
        ${log.confidence_score || 85}%
      </td>
    `;

    // Prepend to top of table
    this.tableBody.insertBefore(row, this.tableBody.firstChild);

    // Enforce capped DOM nodes
    while (this.tableBody.children.length > this.maxRows) {
      this.tableBody.removeChild(this.tableBody.lastChild);
    }
  }

  getSeverityBadge(severity) {
    const sev = (severity || 'safe').toLowerCase();
    switch (sev) {
      case 'critical':
        return { class: 'badge-critical', label: 'CRITICAL' };
      case 'high':
        return { class: 'badge-high', label: 'HIGH' };
      case 'medium':
        return { class: 'badge-medium', label: 'MEDIUM' };
      default:
        return { class: 'badge-safe', label: 'SAFE' };
    }
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.LiveFeedTable = LiveFeedTable;
