/* ============================================================
   ILF — THREAT ENGINE
   /static/js/engine/ThreatEngine.js
   ============================================================ */

(function () {
    "use strict";

    const ThreatEngine = {

        /* --------------------------------------------------------
           Configuration
        -------------------------------------------------------- */

        config: {
            criticalThreshold: 80,
            highThreshold: 60,
            elevatedThreshold: 35,

            clusterWindowMs: 5 * 60 * 1000,

            maxSignals: 5000
        },

        /* --------------------------------------------------------
           Utility
        -------------------------------------------------------- */

        normalize(value) {
            return String(value ?? "")
                .trim()
                .toLowerCase();
        },

        clamp(value, min, max) {
            return Math.min(
                Math.max(value, min),
                max
            );
        },

        safeNumber(value, fallback = 0) {
            const number = Number(value);

            return Number.isFinite(number)
                ? number
                : fallback;
        },

        /* --------------------------------------------------------
           Keyword dictionaries
        -------------------------------------------------------- */

        keywords: {
            critical: [
                "ransomware",
                "credential dump",
                "credential dumping",
                "privilege escalation",
                "data exfiltration",
                "exfiltration",
                "malware",
                "rootkit",
                "persistence",
                "command and control",
                "c2",
                "reverse shell"
            ],

            high: [
                "failed login",
                "authentication failure",
                "brute force",
                "powershell",
                "remote access",
                "ssh",
                "rdp",
                "suspicious",
                "unauthorized",
                "blocked",
                "denied",
                "execution"
            ],

            elevated: [
                "warning",
                "anomaly",
                "unexpected",
                "connection",
                "network",
                "process",
                "file modified",
                "file deleted",
                "upload",
                "download"
            ]
        },

        /* --------------------------------------------------------
           MITRE mapping
        -------------------------------------------------------- */

        mitreMap: [
            {
                id: "T1059",
                name: "Command and Scripting Interpreter",
                keywords: [
                    "command",
                    "shell",
                    "powershell",
                    "cmd",
                    "script",
                    "execution"
                ]
            },

            {
                id: "T1078",
                name: "Valid Accounts",
                keywords: [
                    "login",
                    "authentication",
                    "account",
                    "credential",
                    "user"
                ]
            },

            {
                id: "T1110",
                name: "Brute Force",
                keywords: [
                    "brute force",
                    "failed login",
                    "authentication failure",
                    "password failure"
                ]
            },

            {
                id: "T1021",
                name: "Remote Services",
                keywords: [
                    "ssh",
                    "rdp",
                    "remote access",
                    "remote service"
                ]
            },

            {
                id: "T1041",
                name: "Exfiltration Over C2 Channel",
                keywords: [
                    "exfiltration",
                    "exfil",
                    "data transfer",
                    "data export"
                ]
            },

            {
                id: "T1566",
                name: "Phishing",
                keywords: [
                    "phishing",
                    "malicious email",
                    "suspicious email",
                    "attachment"
                ]
            },

            {
                id: "T1547",
                name: "Boot or Logon Autostart Execution",
                keywords: [
                    "startup",
                    "autostart",
                    "persistence",
                    "autorun"
                ]
            },

            {
                id: "T1055",
                name: "Process Injection",
                keywords: [
                    "process injection",
                    "injected process",
                    "injection"
                ]
            }
        ],

        /* --------------------------------------------------------
           Build searchable text
        -------------------------------------------------------- */

        getSearchText(record) {
            return this.normalize(
                [
                    record.raw,
                    record.message,
                    record.eventType,
                    record.sourceIp,
                    record.destinationIp,
                    record.username,
                    record.hostname
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        },

        /* --------------------------------------------------------
           Keyword scoring
        -------------------------------------------------------- */

        keywordScore(text) {
            let score = 0;

            const matches = [];

            const checkGroup = (
                words,
                points
            ) => {
                words.forEach((keyword) => {
                    if (text.includes(keyword)) {
                        score += points;
                        matches.push(keyword);
                    }
                });
            };

            checkGroup(
                this.keywords.critical,
                35
            );

            checkGroup(
                this.keywords.high,
                20
            );

            checkGroup(
                this.keywords.elevated,
                8
            );

            return {
                score: this.clamp(
                    score,
                    0,
                    100
                ),
                matches
            };
        },

        /* --------------------------------------------------------
           Severity score
        -------------------------------------------------------- */

        calculateScore(record) {
            const text =
                this.getSearchText(record);

            const keywordResult =
                this.keywordScore(text);

            let score =
                keywordResult.score;

            const parserSeverity =
                this.normalize(
                    record.severity
                );

            if (parserSeverity === "critical") {
                score += 35;
            } else if (
                parserSeverity === "high"
            ) {
                score += 25;
            } else if (
                parserSeverity === "medium"
            ) {
                score += 12;
            }

            /*
             * Network source + destination pair.
             */
            if (
                record.sourceIp &&
                record.destinationIp
            ) {
                score += 5;
            }

            /*
             * Remote access events deserve additional context.
             */
            if (
                [
                    "remote_access",
                    "access_failure"
                ].includes(
                    this.normalize(
                        record.eventType
                    )
                )
            ) {
                score += 8;
            }

            return {
                score: this.clamp(
                    score,
                    0,
                    100
                ),
                matches:
                    keywordResult.matches
            };
        },

        /* --------------------------------------------------------
           Severity classification
        -------------------------------------------------------- */

        classifySeverity(score) {
            if (
                score >=
                this.config.criticalThreshold
            ) {
                return "Critical";
            }

            if (
                score >=
                this.config.highThreshold
            ) {
                return "High";
            }

            if (
                score >=
                this.config.elevatedThreshold
            ) {
                return "Elevated";
            }

            return "Notice";
        },

        /* --------------------------------------------------------
           MITRE technique detection
        -------------------------------------------------------- */

        detectMitre(record) {
            const text =
                this.getSearchText(record);

            const matches = [];

            this.mitreMap.forEach(
                (technique) => {
                    const matchedKeywords =
                        technique.keywords.filter(
                            (keyword) =>
                                text.includes(
                                    keyword
                                )
                        );

                    if (
                        matchedKeywords.length
                    ) {
                        matches.push({
                            id: technique.id,
                            name: technique.name,
                            confidence:
                                this.clamp(
                                    45 +
                                    matchedKeywords.length *
                                        15,
                                    0,
                                    100
                                ),
                            matchedKeywords
                        });
                    }
                }
            );

            return matches;
        },

        /* --------------------------------------------------------
           Analyze one record
        -------------------------------------------------------- */

        analyzeRecord(record, index = 0) {
            if (!record) {
                return null;
            }

            const result =
                this.calculateScore(record);

            const severity =
                this.classifySeverity(
                    result.score
                );

            const mitre =
                this.detectMitre(record);

            return {
                ...record,

                signalId:
                    record.id ||
                    `signal-${index + 1}`,

                threatScore:
                    result.score,

                threatSeverity:
                    severity,

                threatMatches:
                    result.matches,

                mitreTechniques:
                    mitre,

                isThreat:
                    result.score >=
                    this.config.elevatedThreshold,

                analyzedAt:
                    new Date().toISOString()
            };
        },

        /* --------------------------------------------------------
           Analyze collection
        -------------------------------------------------------- */

        analyze(records) {
            const input =
                Array.isArray(records)
                    ? records
                    : [];

            const limited =
                input.slice(
                    0,
                    this.config.maxSignals
                );

            const signals =
                limited
                    .map(
                        (record, index) =>
                            this.analyzeRecord(
                                record,
                                index
                            )
                    )
                    .filter(Boolean);

            return {
                signals,
                summary:
                    this.summarize(signals)
            };
        },

        /* --------------------------------------------------------
           Incident clustering
        -------------------------------------------------------- */

        clusterSignals(signals) {
            const input =
                Array.isArray(signals)
                    ? signals
                    : [];

            const threatSignals =
                input.filter(
                    (signal) =>
                        signal.isThreat
                );

            const clusters = [];

            threatSignals.forEach(
                (signal) => {
                    const timestamp =
                        Date.parse(
                            signal.timestamp
                        );

                    const source =
                        signal.sourceIp ||
                        "unknown";

                    const technique =
                        signal.mitreTechniques?.[0]?.id ||
                        "unmapped";

                    const existing =
                        clusters.find(
                            (cluster) => {
                                const sameSource =
                                    cluster.sourceIp ===
                                    source;

                                const sameTechnique =
                                    cluster.techniqueId ===
                                    technique;

                                const timeMatch =
                                    !Number.isNaN(
                                        timestamp
                                    ) &&
                                    !Number.isNaN(
                                        cluster.lastTimestamp
                                    ) &&
                                    Math.abs(
                                        timestamp -
                                        cluster.lastTimestamp
                                    ) <=
                                    this.config
                                        .clusterWindowMs;

                                return (
                                    sameSource &&
                                    (
                                        sameTechnique ||
                                        timeMatch
                                    )
                                );
                            }
                        );

                    if (existing) {
                        existing.signals.push(
                            signal
                        );

                        existing.lastTimestamp =
                            Number.isNaN(timestamp)
                                ? existing.lastTimestamp
                                : timestamp;

                        existing.threatScore =
                            Math.max(
                                existing.threatScore,
                                signal.threatScore
                            );

                        return;
                    }

                    clusters.push({
                        id:
                            `cluster-${clusters.length + 1}`,

                        sourceIp:
                            source,

                        techniqueId:
                            technique,

                        techniqueName:
                            signal.mitreTechniques?.[0]?.name ||
                            "Unmapped Activity",

                        firstTimestamp:
                            Number.isNaN(timestamp)
                                ? null
                                : timestamp,

                        lastTimestamp:
                            Number.isNaN(timestamp)
                                ? null
                                : timestamp,

                        threatScore:
                            signal.threatScore,

                        severity:
                            signal.threatSeverity,

                        signals: [
                            signal
                        ]
                    });
                }
            );

            return clusters.map(
                (cluster) => ({
                    ...cluster,

                    signalCount:
                        cluster.signals.length,

                    confidence:
                        this.calculateClusterConfidence(
                            cluster
                        )
                })
            );
        },

        /* --------------------------------------------------------
           Cluster confidence
        -------------------------------------------------------- */

        calculateClusterConfidence(cluster) {
            const signalCount =
                cluster.signals?.length || 0;

            const scores =
                (cluster.signals || [])
                    .map(
                        (signal) =>
                            this.safeNumber(
                                signal.threatScore
                            )
                    );

            const average =
                scores.length
                    ? scores.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / scores.length
                    : 0;

            const volumeBonus =
                Math.min(
                    signalCount * 4,
                    20
                );

            return Math.round(
                this.clamp(
                    average +
                    volumeBonus,
                    0,
                    100
                )
            );
        },

        /* --------------------------------------------------------
           Dashboard summary
        -------------------------------------------------------- */

        summarize(signals) {
            const data =
                Array.isArray(signals)
                    ? signals
                    : [];

            const severity = {
                Critical: 0,
                High: 0,
                Elevated: 0,
                Notice: 0
            };

            const techniques = {};

            let totalThreatScore = 0;
            let threatSignals = 0;

            data.forEach((signal) => {
                const level =
                    signal.threatSeverity ||
                    "Notice";

                if (
                    Object.prototype.hasOwnProperty.call(
                        severity,
                        level
                    )
                ) {
                    severity[level] += 1;
                }

                if (signal.isThreat) {
                    threatSignals += 1;
                }

                totalThreatScore +=
                    this.safeNumber(
                        signal.threatScore
                    );

                (
                    signal.mitreTechniques ||
                    []
                ).forEach(
                    (technique) => {
                        if (
                            !techniques[
                                technique.id
                            ]
                        ) {
                            techniques[
                                technique.id
                            ] = {
                                id:
                                    technique.id,
                                name:
                                    technique.name,
                                count: 0
                            };
                        }

                        techniques[
                            technique.id
                        ].count += 1;
                    }
                );
            });

            const averageThreatIndex =
                data.length
                    ? Math.round(
                        totalThreatScore /
                        data.length
                    )
                    : 0;

            return {
                totalSignals:
                    data.length,

                threatSignals,

                severity,

                averageThreatIndex,

                techniques:
                    Object.values(
                        techniques
                    ),

                criticalCount:
                    severity.Critical,

                highCount:
                    severity.High,

                elevatedCount:
                    severity.Elevated,

                noticeCount:
                    severity.Notice
            };
        },

        /* --------------------------------------------------------
           Full forensic analysis
        -------------------------------------------------------- */

        run(records) {
            const analysis =
                this.analyze(records);

            const clusters =
                this.clusterSignals(
                    analysis.signals
                );

            const summary = {
                ...analysis.summary,

                activeClusters:
                    clusters.length,

                criticalClusters:
                    clusters.filter(
                        (cluster) =>
                            cluster.severity ===
                            "Critical"
                    ).length,

                highClusters:
                    clusters.filter(
                        (cluster) =>
                            cluster.severity ===
                            "High"
                    ).length
            };

            return {
                signals:
                    analysis.signals,

                clusters,

                summary,

                generatedAt:
                    new Date().toISOString()
            };
        }
    };

    /* ------------------------------------------------------------
       Global API
       ------------------------------------------------------------ */

    window.ThreatEngine =
        ThreatEngine;

})();