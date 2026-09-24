/**
 * INTELLIGENT LOG FORENSIC - LOG PARSER ENGINE
 * Resilient multi-format ingestion (JSON, Apache, Syslog, RFC 2822, CSV, Raw Text)
 * Zero-copy fresh implementation with line-level failure recovery
 */

class LogParser {
  constructor() {
    // Exact Apache Combined Log format regex ensuring status code is separate from IP octets
    // Format: %h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-agent}i\"
    this.apacheRegex = /^(\d{1,3}(?:\.\d{1,3}){3})\s+([^\s]+)\s+([^\s]+)\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^\s]+)(?:\s+HTTP\/[\d\.]+)?\"\s+(\d{3})\s+(\d+|-)/;

    // Syslog standard RFC 3164 / 5424 regex
    // Format: Mon DD HH:MM:SS host proc[pid]: message
    this.syslogRegex = /^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+([a-zA-Z0-9_\-\.]+)\s+([^:\[]+)(?:\[(\d+)\])?:\s+(.*)$/;

    // Generic IPv4 finder
    this.ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
  }

  /**
   * Main parsing dispatcher with line-level error isolation
   */
  parseBatch(rawContent, formatHint = 'auto') {
    if (!rawContent || typeof rawContent !== 'string') {
      return { logs: [], errorCount: 1, totalLines: 0 };
    }

    const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    const parsedLogs = [];
    let errorCount = 0;
    let completedFieldsCount = 0;
    const maxPossibleFieldsPerLog = 6; // timestamp, ip, target, method, payload, severity

    // Auto-detect format if not explicitly provided
    let format = formatHint;
    if (format === 'auto') {
      const sample = lines[0].trim();
      if (sample.startsWith('{') && sample.endsWith('}')) {
        format = 'json';
      } else if (sample.includes(',') && (sample.toLowerCase().includes('ip') || sample.toLowerCase().includes('timestamp'))) {
        format = 'csv';
      } else if (this.apacheRegex.test(sample)) {
        format = 'apache';
      } else {
        format = 'text';
      }
    }

    if (format === 'csv') {
      return this.parseCSVLines(lines);
    }

    lines.forEach((line, index) => {
      try {
        let entry = null;
        if (format === 'json') {
          entry = this.parseJsonLine(line, index);
        } else if (format === 'apache') {
          entry = this.parseApacheLine(line, index);
        } else if (format === 'syslog') {
          entry = this.parseSyslogLine(line, index);
        } else {
          entry = this.parseGenericLine(line, index);
        }

        if (entry) {
          // Count fields for completeness
          if (entry.timestamp) completedFieldsCount++;
          if (entry.source_ip && entry.source_ip !== '127.0.0.1') completedFieldsCount++;
          if (entry.target) completedFieldsCount++;
          if (entry.method) completedFieldsCount++;
          if (entry.payload_snippet) completedFieldsCount++;
          if (entry.severity) completedFieldsCount++;

          parsedLogs.push(entry);
        } else {
          errorCount++;
        }
      } catch (err) {
        // Line-level isolation: never kill batch parse on single bad record
        errorCount++;
      }
    });

    return {
      logs: parsedLogs,
      errorCount,
      totalLines: lines.length,
      completedFieldsCount,
      maxPossibleFields: lines.length * maxPossibleFieldsPerLog
    };
  }

  parseJsonLine(line, index) {
    try {
      const obj = JSON.parse(line);
      return {
        id: obj.id || `LOG-${index + 1}-${Date.now().toString(36)}`,
        timestamp: this.normalizeTimestamp(obj.timestamp || obj.time || obj['@timestamp']),
        source_ip: obj.source_ip || obj.ip || obj.clientip || obj.src_ip || '127.0.0.1',
        target: obj.target || obj.path || obj.url || obj.endpoint || '/',
        method: (obj.method || obj.http_method || 'GET').toUpperCase(),
        payload_snippet: obj.payload || obj.query || obj.message || obj.payload_snippet || '',
        status_code: parseInt(obj.status || obj.status_code || 200, 10),
        raw_message: typeof obj.message === 'string' ? obj.message : JSON.stringify(obj)
      };
    } catch (e) {
      return null;
    }
  }

  parseApacheLine(line, index) {
    const match = this.apacheRegex.exec(line);
    if (!match) {
      return this.parseGenericLine(line, index);
    }
    return {
      id: `APACHE-${index + 1}-${Date.now().toString(36)}`,
      source_ip: match[1],
      timestamp: this.normalizeTimestamp(match[4]),
      method: match[5].toUpperCase(),
      target: match[6],
      status_code: parseInt(match[7], 10),
      payload_snippet: match[6],
      raw_message: line
    };
  }

  parseSyslogLine(line, index) {
    const match = this.syslogRegex.exec(line);
    if (!match) {
      return this.parseGenericLine(line, index);
    }
    const message = match[5];
    const ipMatch = this.ipRegex.exec(message);

    return {
      id: `SYSLOG-${index + 1}-${Date.now().toString(36)}`,
      timestamp: this.normalizeTimestamp(match[1]),
      source_ip: ipMatch ? ipMatch[0] : match[2],
      target: match[3],
      method: 'SYS',
      payload_snippet: message.substring(0, 80),
      raw_message: line
    };
  }

  parseGenericLine(line, index) {
    const ipMatch = this.ipRegex.exec(line);
    const methodMatch = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|SSH|SCAN|AUTH|SUDO)\b/i.exec(line);
    
    // Status code regex: Look specifically for HTTP status codes bounded by spaces or quotes, avoiding IP octets
    const statusMatch = /(?:\s|")([1-5]\d{2})(?:\s|"|$)/.exec(line);

    return {
      id: `TXT-${index + 1}-${Date.now().toString(36)}`,
      timestamp: this.extractTimestamp(line) || new Date().toISOString(),
      source_ip: ipMatch ? ipMatch[0] : '192.168.1.100',
      target: this.extractTarget(line) || '/system/api',
      method: methodMatch ? methodMatch[1].toUpperCase() : 'EVENT',
      status_code: statusMatch ? parseInt(statusMatch[1], 10) : 200,
      payload_snippet: line.substring(0, 100),
      raw_message: line
    };
  }

  parseCSVLines(lines) {
    if (lines.length < 2) return { logs: [], errorCount: 0, totalLines: 0 };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const parsedLogs = [];
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
        if (parts.length < headers.length) {
          errorCount++;
          continue;
        }

        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx];
        });

        parsedLogs.push({
          id: `CSV-${i}-${Date.now().toString(36)}`,
          timestamp: this.normalizeTimestamp(rowObj.timestamp || rowObj.time || rowObj.date),
          source_ip: rowObj.ip || rowObj.source_ip || rowObj.src_ip || '192.168.1.50',
          target: rowObj.target || rowObj.endpoint || rowObj.url || rowObj.path || '/',
          method: (rowObj.method || 'GET').toUpperCase(),
          status_code: parseInt(rowObj.status || rowObj.status_code || 200, 10),
          payload_snippet: rowObj.payload || rowObj.query || rowObj.message || '',
          raw_message: lines[i]
        });
      } catch (e) {
        errorCount++;
      }
    }

    return {
      logs: parsedLogs,
      errorCount,
      totalLines: lines.length - 1,
      completedFieldsCount: parsedLogs.length * 6,
      maxPossibleFields: (lines.length - 1) * 6
    };
  }

  /**
   * Resilient timestamp normalizer supporting Apache, RFC 2822, Syslog, and ISO-8601
   */
  normalizeTimestamp(raw) {
    if (!raw) return new Date().toISOString();

    // Check if valid ISO already
    const isoDate = new Date(raw);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    // Apache format: 10/Oct/2026:13:55:36 +0000
    const apacheMatch = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/.exec(raw);
    if (apacheMatch) {
      const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const m = monthMap[apacheMatch[2]] || '01';
      return `${apacheMatch[3]}-${m}-${apacheMatch[1]}T${apacheMatch[4]}:${apacheMatch[5]}:${apacheMatch[6]}Z`;
    }

    // Syslog format: Oct 24 13:55:36
    const syslogMatch = /^([A-Za-z]{3})\s+(\d+)\s+(\d{2}):(\d{2}):(\d{2})/.exec(raw);
    if (syslogMatch) {
      const currentYear = new Date().getFullYear();
      const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const m = monthMap[syslogMatch[1]] || '01';
      const d = syslogMatch[2].padStart(2, '0');
      return `${currentYear}-${m}-${d}T${syslogMatch[3]}:${syslogMatch[4]}:${syslogMatch[5]}Z`;
    }

    return new Date().toISOString();
  }

  extractTimestamp(line) {
    // Try to extract ISO date or timestamp pattern
    const match = /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/.exec(line);
    return match ? new Date(match[0]).toISOString() : null;
  }

  extractTarget(line) {
    const match = /(?:\s)(?:\/[a-zA-Z0-9_\-\.\/]+)(?:\?[^\s"]*)?/.exec(line);
    return match ? match[0].trim() : null;
  }
}

// Global Singleton
window.logParser = new LogParser();
