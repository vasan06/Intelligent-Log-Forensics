/**
 * INTELLIGENT LOG FORENSIC - THREAT ENGINE
 * Fresh, production-grade cybersecurity heuristic detection & ML-style scoring engine
 * Zero-copy fresh architecture
 */

class ThreatEngine {
  constructor() {
    // Stateful tracking across logs & sessions
    this.ipProfiler = new Map(); // ip -> { count, failures, lastSeen, endpoints: Set, flags: [] }
    this.signatureDatabase = this.initializeSignatures();
    this.eventDeduplicationCache = new Set();
    this.MAX_DEDUP_CACHE = 5000;
  }

  initializeSignatures() {
    return [
      {
        id: 'SIG-SQLI',
        name: 'SQL Injection Exploitation',
        technique: 'T1190',
        tactic: 'Initial Access',
        regex: /(\bUNION\b[\s+]+SELECT|\bOR\b[\s+]+['"]?\d+['"]?\s*=\s*['"]?\d+|--|;--|\bSLEEP\(\d+\)|'\s*OR\s*'1'='1|INFORMATION_SCHEMA)/i,
        baseSeverity: 'critical',
        baseConfidence: 94
      },
      {
        id: 'SIG-TRAV',
        name: 'Directory Path Traversal',
        technique: 'T1083',
        tactic: 'Discovery',
        regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\/etc\/passwd|\/etc\/shadow|win\.ini|boot\.ini)/i,
        baseSeverity: 'high',
        baseConfidence: 90
      },
      {
        id: 'SIG-XSS',
        name: 'Cross-Site Scripting Probe',
        technique: 'T1059',
        tactic: 'Execution',
        regex: /(<script[\s\S]*?>|javascript:|onload\s*=|onerror\s*=|alert\(|document\.cookie|<img\s+src=x\s+onerror)/i,
        baseSeverity: 'high',
        baseConfidence: 86
      },
      {
        id: 'SIG-C2',
        name: 'C2 Beaconing / Reverse Shell',
        technique: 'T1071',
        tactic: 'Command and Control',
        regex: /(\/c2\/beacon|heartbeat_check|cmd\.exe\s+\/c|\/bin\/(ba)?sh\s+-i|base64_decode\()/i,
        baseSeverity: 'critical',
        baseConfidence: 96
      },
      {
        id: 'SIG-DUMP',
        name: 'Credential Dumping Tool Artifact',
        technique: 'T1003',
        tactic: 'Credential Access',
        regex: /(mimikatz|sekurlsa|procdump|lsass\.dmp|\/etc\/shadow|samdump2|secretsdump)/i,
        baseSeverity: 'critical',
        baseConfidence: 98
      },
      {
        id: 'SIG-SUDO',
        name: 'Unauthorized Privilege Escalation',
        technique: 'T1068',
        tactic: 'Privilege Escalation',
        regex: /(sudo\s+.*NOPASSWD|chmod\s+\+s|setuid|pkexec\s+--user|\/bin\/bash\s+-p)/i,
        baseSeverity: 'high',
        baseConfidence: 89
      },
      {
        id: 'SIG-EXFIL',
        name: 'High-Volume Data Exfiltration',
        technique: 'T1041',
        tactic: 'Exfiltration',
        regex: /(POST\s+\/(upload|backup|sync).*([0-9]{3,}\s*MB|[0-9]{6,}\s*bytes)|curl\s+-F\s+file=@)/i,
        baseSeverity: 'critical',
        baseConfidence: 92
      }
    ];
  }

  /**
   * Evaluates a single normalized log entry against all threat heuristic vectors
   */
  inspectLog(logEntry) {
    const findings = [];
    const sourceIp = logEntry.source_ip || 'unknown';
    const payload = `${logEntry.method || ''} ${logEntry.target || ''} ${logEntry.payload_snippet || ''} ${logEntry.raw_message || ''}`;

    // 1. IP Profiling & Historical Frequency Analysis
    let ipProfile = this.ipProfiler.get(sourceIp);
    if (!ipProfile) {
      ipProfile = { count: 0, authFailures: 0, endpoints: new Set(), lastSeen: Date.now() };
      this.ipProfiler.set(sourceIp, ipProfile);
    }
    ipProfile.count += 1;
    ipProfile.lastSeen = Date.now();
    if (logEntry.target) {
      ipProfile.endpoints.add(logEntry.target);
    }

    // 2. Exploit Signature Scanning
    let matchedSig = null;
    for (const sig of this.signatureDatabase) {
      if (sig.regex.test(payload)) {
        matchedSig = sig;
        findings.push({
          type: 'EXPLOIT_SIGNATURE',
          signatureId: sig.id,
          name: sig.name,
          technique: sig.technique,
          tactic: sig.tactic,
          severity: sig.baseSeverity,
          confidence: sig.baseConfidence
        });
        break; // prioritize primary signature
      }
    }

    // 3. Authentication Failure & Brute Force Pattern Analysis
    const isAuthFail = /AUTH FAIL|Failed password|login failure|invalid credentials|401 Unauthorized/i.test(payload);
    if (isAuthFail) {
      ipProfile.authFailures += 1;
      if (ipProfile.authFailures >= 3) {
        findings.push({
          type: 'BRUTE_FORCE',
          signatureId: 'SIG-BRUTE',
          name: 'Credential Brute Force Attack',
          technique: 'T1110',
          tactic: 'Credential Access',
          severity: ipProfile.authFailures > 10 ? 'critical' : 'high',
          confidence: Math.min(99, 70 + (ipProfile.authFailures * 3))
        });
      }
    }

    // 4. Reconnaissance & Port / Endpoint Scanning
    if (ipProfile.endpoints.size > 8 || ipProfile.count > 25 || /SCAN|PORT\s+SCAN|nmap/i.test(payload)) {
      findings.push({
        type: 'RECONNAISSANCE',
        signatureId: 'SIG-SCAN',
        name: 'Network Reconnaissance / Port Scan',
        technique: 'T1046',
        tactic: 'Discovery',
        severity: 'medium',
        confidence: 85
      });
    }

    // 5. Service Instability / Server Crash Patterns
    const statusCode = logEntry.status_code;
    if (statusCode && statusCode >= 500 && statusCode <= 599) {
      findings.push({
        type: 'SERVICE_ANOMALY',
        signatureId: 'SIG-5XX',
        name: 'Server Error Exploitation Instability',
        technique: 'T1499',
        tactic: 'Impact',
        severity: 'medium',
        confidence: 72
      });
    }

    // 6. ML-style Heuristic Threat Scoring (0 - 100)
    const compositeScore = this.computeRiskScore(findings, ipProfile, logEntry);

    // 7. Deduplication Check to avoid flooding
    const dedupSignature = `${sourceIp}:${logEntry.target}:${findings.map(f => f.signatureId).join(',')}`;
    const isDuplicate = this.eventDeduplicationCache.has(dedupSignature);
    if (!isDuplicate) {
      this.eventDeduplicationCache.add(dedupSignature);
      if (this.eventDeduplicationCache.size > this.MAX_DEDUP_CACHE) {
        // Clear half of cache to maintain bounded memory
        const keys = Array.from(this.eventDeduplicationCache.keys()).slice(0, 1000);
        keys.forEach(k => this.eventDeduplicationCache.delete(k));
      }
    }

    // Final consolidated severity
    let finalSeverity = 'safe';
    let primaryTechnique = logEntry.mitre_technique || 'None';
    let primaryConfidence = 50;
    let attackType = 'Benign Traffic';

    if (findings.length > 0) {
      // Pick top finding
      const top = findings.sort((a, b) => {
        const ranks = { critical: 4, high: 3, medium: 2, safe: 1 };
        return ranks[b.severity] - ranks[a.severity];
      })[0];

      finalSeverity = top.severity;
      primaryTechnique = top.technique;
      primaryConfidence = top.confidence;
      attackType = top.name;
    } else if (compositeScore > 75) {
      finalSeverity = 'high';
      attackType = 'Anomalous Activity';
    } else if (compositeScore > 40) {
      finalSeverity = 'medium';
      attackType = 'Suspicious Probe';
    }

    return {
      sourceIp,
      compositeScore,
      severity: finalSeverity,
      mitreTechnique: primaryTechnique,
      confidence: primaryConfidence,
      attackType,
      findings,
      isDuplicate,
      isRiskEvent: compositeScore >= 60 || finalSeverity === 'critical' || finalSeverity === 'high'
    };
  }

  /**
   * ML-Heuristic Scoring Function
   */
  computeRiskScore(findings, ipProfile, logEntry) {
    let score = 10; // Baseline benign score

    for (const f of findings) {
      if (f.severity === 'critical') score += 55;
      else if (f.severity === 'high') score += 35;
      else if (f.severity === 'medium') score += 20;
    }

    // IP velocity weight
    if (ipProfile.authFailures > 5) score += 25;
    if (ipProfile.endpoints.size > 10) score += 15;

    // HTTP status code impact
    if (logEntry.status_code === 401 || logEntry.status_code === 403) score += 10;
    if (logEntry.status_code >= 500) score += 15;

    return Math.min(100, Math.max(5, score));
  }

  /**
   * Calculate Trust / Quality Score for a Batch of Logs
   * Formula factors in field completeness %, parse success rate, dedup ratio
   */
  computeBatchTrustQuality(totalProcessed, parseErrors, completedFieldsCount, maxPossibleFields, dedupDuplicates) {
    if (totalProcessed === 0) return { qualityScore: 100, completeness: 100, errorRate: 0 };

    const parseSuccessRate = Math.max(0, ((totalProcessed - parseErrors) / totalProcessed) * 100);
    const fieldCompletenessRate = maxPossibleFields > 0 ? (completedFieldsCount / maxPossibleFields) * 100 : 100;
    const uniquenessRate = Math.max(0, ((totalProcessed - dedupDuplicates) / totalProcessed) * 100);

    // Weighted composite quality score (0 - 100)
    const compositeQuality = Math.round(
      (parseSuccessRate * 0.40) +
      (fieldCompletenessRate * 0.40) +
      (uniquenessRate * 0.20)
    );

    return {
      qualityScore: compositeQuality,
      parseSuccessRate: Math.round(parseSuccessRate),
      fieldCompletenessRate: Math.round(fieldCompletenessRate),
      uniquenessRate: Math.round(uniquenessRate),
      errorCount: parseErrors
    };
  }
}

// Global Singleton
window.threatEngine = new ThreatEngine();
