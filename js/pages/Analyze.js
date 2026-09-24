/**
 * INTELLIGENT LOG FORENSIC - ANALYZE & UPLOAD CONTROLLER
 * Drag-drop log ingestion, SHA-256 evidence hashing, 3D DNA pipeline animation, and forensic breakdown
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D DNA Evidence Helix
  const helixScene = new EvidenceHelixScene('evidence-helix-canvas');

  // 2. Elements
  const dropzone = document.getElementById('log-dropzone');
  const fileInput = document.getElementById('log-file-input');
  const browseBtn = document.getElementById('browse-files-btn');
  const resultsPanel = document.getElementById('analysis-results-panel');
  const currentFileNameEl = document.getElementById('current-file-name');
  const currentFileHashEl = document.getElementById('current-file-hash');

  const pipelineSteps = [
    document.getElementById('step-upload'),
    document.getElementById('step-hash'),
    document.getElementById('step-parse'),
    document.getElementById('step-normalize'),
    document.getElementById('step-detect'),
    document.getElementById('step-score'),
    document.getElementById('step-incident')
  ];

  // Drag and drop event handlers
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) processFile(files[0]);
    });
  }

  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) processFile(fileInput.files[0]);
    });
  }

  // Pre-load demo log button
  const demoLogBtn = document.getElementById('load-demo-logs-btn');
  if (demoLogBtn) {
    demoLogBtn.addEventListener('click', () => {
      const sampleContent = `
{"timestamp": "2026-09-24T12:00:00Z", "source_ip": "198.51.100.44", "method": "POST", "target": "/api/v1/search", "payload": "' OR 1=1 --", "status": 500}
198.51.100.44 - - [24/Sep/2026:12:01:10 +0000] "POST /auth/login HTTP/1.1" 401 240
198.51.100.44 - - [24/Sep/2026:12:01:12 +0000] "POST /auth/login HTTP/1.1" 401 240
198.51.100.44 - - [24/Sep/2026:12:01:15 +0000] "POST /auth/login HTTP/1.1" 401 240
203.0.113.195 - - [24/Sep/2026:12:02:00 +0000] "GET /../../etc/passwd HTTP/1.1" 403 180
10.0.0.12 - - [24/Sep/2026:12:03:00 +0000] "POST /upload HTTP/1.1" 200 847000000
Sep 24 12:04:12 auth-server sudo: guest : COMMAND=/bin/bash
{"timestamp": "2026-09-24T12:05:00Z", "source_ip": "185.220.101.5", "method": "GET", "target": "/c2/beacon", "payload": "base64_decode(dXNlcg==)", "status": 200}
      `.trim();
      const demoBlob = new Blob([sampleContent], { type: 'text/plain' });
      const demoFile = new File([demoBlob], "sample_forensic_evidence.log");
      processFile(demoFile);
    });
  }

  async function processFile(file) {
    if (!file) return;

    // Reset pipeline UI
    pipelineSteps.forEach(s => s && s.classList.remove('active', 'complete'));
    resultsPanel.classList.remove('visible');
    currentFileNameEl.textContent = file.name;
    currentFileHashEl.textContent = 'Computing cryptographic hash...';

    // Step 0: Upload
    setStepState(0);
    const content = await file.text();

    // Step 1: SHA-256 Hash Verification
    await delay(450);
    setStepState(1);
    const hash = await computeSHA256(content);
    currentFileHashEl.textContent = hash;

    // Step 2: Multi-format Parsing
    await delay(500);
    setStepState(2);
    const parseResult = window.logParser.parseBatch(content);

    // Step 3: Normalization
    await delay(400);
    setStepState(3);

    // Step 4: Rules Applied & Exploit Detection
    await delay(500);
    setStepState(4);
    const evaluatedLogs = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let safeCount = 0;

    parseResult.logs.forEach(log => {
      const evaluation = window.threatEngine.inspectLog(log);
      log.severity = evaluation.severity;
      log.compositeScore = evaluation.compositeScore;
      log.confidence_score = evaluation.confidence;
      log.mitre_technique = evaluation.mitreTechnique;
      log.attackType = evaluation.attackType;

      if (log.severity === 'critical') criticalCount++;
      else if (log.severity === 'high') highCount++;
      else if (log.severity === 'medium') mediumCount++;
      else safeCount++;

      evaluatedLogs.push(log);
      // Ingest into AppState
      if (window.appState) {
        window.appState.addLogEntry(log);
      }
    });

    // Step 5: ML Heuristic Scoring & Quality Assessment
    await delay(450);
    setStepState(5);
    const batchQuality = window.threatEngine.computeBatchTrustQuality(
      parseResult.totalLines,
      parseResult.errorCount,
      parseResult.completedFieldsCount,
      parseResult.maxPossibleFields,
      0
    );

    // Step 6: Incident Creation & Correlation
    await delay(450);
    setStepState(6);
    markAllComplete();

    await syncEvidenceWithBackend(file);

    // Display Results Panel
    renderAnalysisResults({
      fileName: file.name,
      hash,
      totalParsed: evaluatedLogs.length,
      errorCount: parseResult.errorCount,
      batchQuality,
      criticalCount,
      highCount,
      mediumCount,
      safeCount,
      logs: evaluatedLogs
    });
  }

  async function syncEvidenceWithBackend(file) {
    const payload = new FormData();
    payload.append('evidence_stream', file, file.name);

    try {
      const response = await fetch('/api/v1/ingest', {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Upload failed (${response.status})`);
      }
      currentFileHashEl.textContent = result.digest;
    } catch (error) {
      currentFileHashEl.textContent = `Backend sync failed: ${error.message}`;
      currentFileHashEl.style.color = 'var(--threat-critical)';
      console.error('[Analyze] Backend ingestion failed:', error);
    }
  }

  function setStepState(index) {
    if (helixScene) {
      helixScene.setPipelineProgress(index);
    }
    pipelineSteps.forEach((s, idx) => {
      if (!s) return;
      if (idx < index) {
        s.classList.remove('active');
        s.classList.add('complete');
      } else if (idx === index) {
        s.classList.add('active');
        s.classList.remove('complete');
      } else {
        s.classList.remove('active', 'complete');
      }
    });
  }

  function markAllComplete() {
    pipelineSteps.forEach(s => {
      if (s) {
        s.classList.remove('active');
        s.classList.add('complete');
      }
    });
  }

  function renderAnalysisResults(data) {
    resultsPanel.classList.add('visible');

    document.getElementById('res-total-logs').textContent = data.totalParsed;
    document.getElementById('res-threat-count').textContent = data.criticalCount + data.highCount;
    document.getElementById('res-trust-score').textContent = `${data.batchQuality.qualityScore}%`;
    document.getElementById('res-crit-count').textContent = data.criticalCount;
    document.getElementById('res-high-count').textContent = data.highCount;
    document.getElementById('res-med-count').textContent = data.mediumCount;
    document.getElementById('res-safe-count').textContent = data.safeCount;

    // Render preview table of detected records
    const tbody = document.getElementById('analysis-preview-table-body');
    if (tbody) {
      tbody.innerHTML = data.logs.slice(0, 10).map(log => `
        <tr>
          <td class="forensic-mono">${new Date(log.timestamp).toLocaleTimeString()}</td>
          <td class="forensic-mono" style="color: #67E8F9;">${log.source_ip}</td>
          <td><span class="badge ${getBadgeClass(log.severity)}">${log.severity.toUpperCase()}</span></td>
          <td class="forensic-mono">${log.mitre_technique}</td>
          <td class="forensic-mono">${escapeHTML(log.payload_snippet || log.raw_message || '')}</td>
          <td class="forensic-mono" style="color: #F1F5F9; font-weight: 600;">${log.confidence_score}%</td>
        </tr>
      `).join('');
    }

    resultsPanel.scrollIntoView({ behavior: 'smooth' });
  }

  function getBadgeClass(sev) {
    if (sev === 'critical') return 'badge-critical';
    if (sev === 'high') return 'badge-high';
    if (sev === 'medium') return 'badge-medium';
    return 'badge-safe';
  }

  async function computeSHA256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }
});
