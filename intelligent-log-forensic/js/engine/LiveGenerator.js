/**
 * INTELLIGENT LOG FORENSIC - LIVE LOG GENERATOR
 * Generates continuous multi-vector attack scenarios and benign telemetry (800ms - 2000ms)
 * Automatically groups into batch logs every 10 records
 */

class LiveGenerator {
  constructor() {
    this.timerId = null;
    this.isRunning = false;
    this.currentBatchCounter = 1;
    this.currentBatchLogs = [];
    this.sourceIpPool = [
      '198.51.100.44', '203.0.113.195', '185.220.101.5', '45.146.164.110',
      '192.168.1.105', '10.0.0.12', '172.16.4.88', '194.26.29.112'
    ];

    // 10 Attack scenario profiles specified in master prompt
    this.scenarios = [
      {
        attackType: 'SQL Injection',
        technique: 'T1190',
        method: 'POST',
        target: '/api/v1/search',
        payload: "' OR 1=1 --",
        severity: 'critical',
        confidence: 96,
        status: 500
      },
      {
        attackType: 'Brute Force Login',
        technique: 'T1110',
        method: 'POST',
        target: '/auth/login',
        payload: 'AUTH FAIL — user: admin — attempt 47/50',
        severity: 'high',
        confidence: 89,
        status: 401
      },
      {
        attackType: 'Directory Traversal',
        technique: 'T1083',
        method: 'GET',
        target: '/static/../../etc/passwd',
        payload: 'GET /../../etc/passwd — 403 Forbidden',
        severity: 'high',
        confidence: 92,
        status: 403
      },
      {
        attackType: 'XSS Probe',
        technique: 'T1059',
        method: 'GET',
        target: '/search?q=<script>alert(1)</script>',
        payload: 'GET /search?q=<script>alert(1)</script>',
        severity: 'medium',
        confidence: 84,
        status: 200
      },
      {
        attackType: 'Port Scan',
        technique: 'T1046',
        method: 'SCAN',
        target: '192.168.1.0/24',
        payload: 'SCAN — 192.168.1.x — ports 22,80,443,3306,8080',
        severity: 'medium',
        confidence: 88,
        status: 200
      },
      {
        attackType: 'Privilege Escalation',
        technique: 'T1068',
        method: 'SUDO',
        target: '/usr/bin/sudo',
        payload: 'SUDO — user: guest — command: /bin/bash (NOPASSWD)',
        severity: 'critical',
        confidence: 94,
        status: 0
      },
      {
        attackType: 'Data Exfiltration',
        technique: 'T1041',
        method: 'POST',
        target: '/api/v2/upload',
        payload: 'POST /upload — 847MB — outbound to external IP 185.220.101.5',
        severity: 'critical',
        confidence: 98,
        status: 200
      },
      {
        attackType: 'Malware Beacon',
        technique: 'T1071',
        method: 'GET',
        target: '/c2/beacon',
        payload: 'GET /c2/beacon — interval: 30s — base64 encoded payload',
        severity: 'critical',
        confidence: 95,
        status: 200
      },
      {
        attackType: 'Credential Dump',
        technique: 'T1003',
        method: 'ACCESS',
        target: '/etc/shadow',
        payload: 'ACCESS — /etc/shadow — proc: mimikatz memory read',
        severity: 'critical',
        confidence: 99,
        status: 403
      },
      {
        attackType: 'Lateral Movement',
        technique: 'T1021',
        method: 'SSH',
        target: '10.0.0.47:22',
        payload: 'SSH — 10.0.0.12 → 10.0.0.47 — new privileged session established',
        severity: 'high',
        confidence: 91,
        status: 200
      }
    ];

    // Benign scenarios for realistic enterprise noise
    this.benignTemplates = [
      { method: 'GET', target: '/api/v1/health', payload: 'Health check OK 200ms', severity: 'safe', confidence: 10, status: 200 },
      { method: 'GET', target: '/dashboard/metrics', payload: 'Telemetry polling query', severity: 'safe', confidence: 15, status: 200 },
      { method: 'POST', target: '/api/v1/telemetry/heartbeat', payload: 'Client agent keepalive', severity: 'safe', confidence: 5, status: 200 },
      { method: 'GET', target: '/static/css/theme.css', payload: 'Static asset fetch', severity: 'safe', confidence: 5, status: 304 }
    ];
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (window.appState) {
      window.appState.setGeneratorActive(true);
    }
    this.scheduleNextTick();
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (window.appState) {
      window.appState.setGeneratorActive(false);
    }
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
    return this.isRunning;
  }

  scheduleNextTick() {
    if (!this.isRunning) return;

    // Random interval between 800ms and 2000ms
    const interval = Math.floor(800 + Math.random() * 1200);
    this.timerId = setTimeout(() => {
      this.tick();
      this.scheduleNextTick();
    }, interval);
  }

  tick() {
    // 60% probability of attack event, 40% benign to ensure active SOC feel
    const isAttack = Math.random() < 0.65;
    let logData = null;

    if (isAttack) {
      const scenario = this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
      const sourceIp = this.sourceIpPool[Math.floor(Math.random() * this.sourceIpPool.length)];
      logData = {
        id: `LOG-EVT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        source_ip: sourceIp,
        target: scenario.target,
        method: scenario.method,
        payload_snippet: scenario.payload,
        severity: scenario.severity,
        mitre_technique: scenario.technique,
        confidence_score: scenario.confidence,
        attackType: scenario.attackType,
        status_code: scenario.status
      };
    } else {
      const benign = this.benignTemplates[Math.floor(Math.random() * this.benignTemplates.length)];
      logData = {
        id: `LOG-SYS-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        source_ip: '10.0.4.15',
        target: benign.target,
        method: benign.method,
        payload_snippet: benign.payload,
        severity: 'safe',
        mitre_technique: 'T0000',
        confidence_score: benign.confidence,
        attackType: 'Benign Traffic',
        status_code: benign.status
      };
    }

    // Pass through ThreatEngine for real-time validation & profiling
    if (window.threatEngine) {
      const evaluation = window.threatEngine.inspectLog(logData);
      logData.severity = evaluation.severity;
      logData.compositeScore = evaluation.compositeScore;
      logData.confidence_score = evaluation.confidence;
    }

    // Ingest into AppState
    if (window.appState) {
      window.appState.addLogEntry(logData);
    }

    // Batch Management: Every 10 entries, close batch
    this.currentBatchLogs.push(logData);
    if (this.currentBatchLogs.length >= 10) {
      this.finalizeBatch();
    }
  }

  finalizeBatch() {
    const batchNumber = this.currentBatchCounter++;
    const batchInfo = {
      batchId: `BATCH-FORENSIC-#${String(batchNumber).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      entryCount: this.currentBatchLogs.length,
      criticalCount: this.currentBatchLogs.filter(l => l.severity === 'critical').length,
      highCount: this.currentBatchLogs.filter(l => l.severity === 'high').length,
      fileName: `audit_capture_${Date.now()}_batch_${batchNumber}.log`
    };

    if (window.appState) {
      window.appState.state.batches.unshift(batchInfo);
      if (window.appState.state.batches.length > 50) {
        window.appState.state.batches.pop();
      }
      window.appState.saveToStorage();
    }

    if (window.eventBus) {
      window.eventBus.emit('batch:created', batchInfo);
    }

    this.currentBatchLogs = [];
  }
}

// Global Singleton
window.liveGenerator = new LiveGenerator();
