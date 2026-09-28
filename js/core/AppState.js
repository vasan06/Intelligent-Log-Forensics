/**
 * INTELLIGENT LOG FORENSIC - GLOBAL APP STATE
 * Manages reactive forensic telemetry, risk scores, incidents, and persistence
 */

class ForensicsStateManager {
  constructor() {
    this.STORAGE_KEY = 'ilf_forensic_state_v1';
    
    // Core telemetry metrics (derived dynamically from generator / analysis)
    this.state = {
      totalLogs: 0,
      riskEvents: 0,
      activeIncidentsCount: 0,
      avgRiskScore: 0,
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        safe: 0
      },
      recentLogs: [],
      incidents: [],
      batches: [],
      generatorActive: true,
      currentUser: {
        id: 'usr_sec_991',
        name: 'Lead Forensics Investigator',
        role: 'SOC Commander',
        lastLogin: new Date().toISOString()
      },
      systemHealth: {
        dbStatus: 'Optimal (Local Store)',
        detectionEngine: 'Active · ThreatEngine v3.2',
        generatorLatency: '1.2s avg',
        heapMemory: '48.2 MB'
      }
    };

    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge selectively to maintain structure
        this.state.totalLogs = parsed.totalLogs || 0;
        this.state.riskEvents = parsed.riskEvents || 0;
        this.state.severityCounts = parsed.severityCounts || this.state.severityCounts;
        this.state.recentLogs = (parsed.recentLogs || []).slice(0, 100);
        this.state.incidents = parsed.incidents || [];
        this.state.batches = parsed.batches || [];
        this.state.activeIncidentsCount = this.state.incidents.length;
        this.recalculateScore();
      }
    } catch (e) {
      console.warn('[AppState] Failed to hydrate state from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const dataToSave = {
        totalLogs: this.state.totalLogs,
        riskEvents: this.state.riskEvents,
        severityCounts: this.state.severityCounts,
        recentLogs: this.state.recentLogs.slice(0, 60), // keep reasonable size
        incidents: this.state.incidents.slice(0, 30),
        batches: this.state.batches.slice(0, 20)
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      // quota exceeded or storage disabled
    }
  }

  recalculateScore() {
    const total = this.state.totalLogs;
    if (total === 0) {
      this.state.avgRiskScore = 0;
      return;
    }
    const c = this.state.severityCounts;
    // Heuristic: weighted severity divided by total samples, normalized to 100
    const weightedSum = (c.critical * 95) + (c.high * 75) + (c.medium * 45) + (c.safe * 10);
    this.state.avgRiskScore = Math.min(100, Math.round(weightedSum / total));
  }

  addLogEntry(log) {
    this.state.totalLogs += 1;
    
    const sev = (log.severity || 'safe').toLowerCase();
    if (this.state.severityCounts[sev] !== undefined) {
      this.state.severityCounts[sev] += 1;
    } else {
      this.state.severityCounts.safe += 1;
    }

    if (sev === 'critical' || sev === 'high' || (log.confidence_score && log.confidence_score >= 70)) {
      this.state.riskEvents += 1;
    }

    this.recalculateScore();

    // Maintain recent logs queue
    this.state.recentLogs.unshift(log);
    if (this.state.recentLogs.length > 100) {
      this.state.recentLogs.pop();
    }

    // Auto-correlate into incident if critical threshold exceeded
    if (sev === 'critical' && (!log.incidentLinked)) {
      this.checkAndCorrelateIncident(log);
    }

    this.saveToStorage();

    if (window.eventBus) {
      window.eventBus.emit('log:added', log);
      window.eventBus.emit('stats:updated', this.getStats());
    }
  }

  checkAndCorrelateIncident(log) {
    // Find or create incident for this attack scenario
    const existing = this.state.incidents.find(inc => 
      inc.mitreTechnique === log.mitre_technique && inc.status === 'ACTIVE'
    );

    if (existing) {
      existing.eventCount = (existing.eventCount || 1) + 1;
      existing.lastSeen = log.timestamp;
      existing.timeline.push({
        timestamp: log.timestamp,
        source: log.source_ip,
        target: log.target,
        payload: log.payload_snippet,
        description: `Correlated attack signal: ${log.method || 'ACTION'} on ${log.target}`
      });
      if (window.eventBus) {
        window.eventBus.emit('incident:updated', existing);
      }
    } else {
      const newInc = {
        id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `${log.attackType || 'High-Risk Exploitation'} Detected`,
        severity: log.severity,
        mitreTechnique: log.mitre_technique,
        confidence: log.confidence_score || 88,
        status: 'ACTIVE',
        created: log.timestamp,
        lastSeen: log.timestamp,
        sourceIp: log.source_ip,
        target: log.target,
        rootCause: `Automated detection triggered via pattern matching for ${log.mitre_technique}. Source ${log.source_ip} exhibited anomalous behavior.`,
        timeline: [
          {
            timestamp: log.timestamp,
            source: log.source_ip,
            target: log.target,
            payload: log.payload_snippet,
            description: `Initial suspicious ingress vector flagged by ThreatEngine.`
          }
        ],
        eventCount: 1
      };
      this.state.incidents.unshift(newInc);
      this.state.activeIncidentsCount = this.state.incidents.length;
      if (window.eventBus) {
        window.eventBus.emit('incident:created', newInc);
      }
    }
  }

  getStats() {
    return {
      totalLogs: this.state.totalLogs,
      riskEvents: this.state.riskEvents,
      activeIncidents: this.state.incidents.filter(i => i.status === 'ACTIVE').length,
      avgRiskScore: this.state.avgRiskScore,
      severityCounts: { ...this.state.severityCounts }
    };
  }

  setGeneratorActive(active) {
    this.state.generatorActive = active;
    if (window.eventBus) {
      window.eventBus.emit('generator:status', active);
    }
  }

  isGeneratorActive() {
    return this.state.generatorActive;
  }
}

// Global Singleton
window.appState = new ForensicsStateManager();
