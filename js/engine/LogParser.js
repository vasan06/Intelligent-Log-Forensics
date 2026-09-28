/* ============================================================
   ILF — LOG PARSER
   /static/js/engine/LogParser.js
   ============================================================ */

(function () {
    "use strict";

    const LogParser = {

        /* --------------------------------------------------------
           Configuration
        -------------------------------------------------------- */

        config: {
            maxLines: 100000,
            defaultSource: "unknown",
            defaultSeverity: "info"
        },

        /* --------------------------------------------------------
           Utility
        -------------------------------------------------------- */

        normalize(value) {
            return String(value ?? "").trim();
        },

        toLower(value) {
            return this.normalize(value).toLowerCase();
        },

        safeNumber(value, fallback = 0) {
            const number = Number(value);

            return Number.isFinite(number)
                ? number
                : fallback;
        },

        /* --------------------------------------------------------
           Timestamp extraction
        -------------------------------------------------------- */

        extractTimestamp(line) {
            const patterns = [

                /*
                 * ISO timestamp
                 */
                /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/,

                /*
                 * YYYY-MM-DD HH:mm:ss
                 */
                /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\b/,

                /*
                 * MM/DD/YYYY HH:mm:ss
                 */
                /\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\b/,

                /*
                 * Syslog style:
                 * Sep 24 15:22:10
                 */
                /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/
            ];

            for (const pattern of patterns) {
                const match = line.match(pattern);

                if (match) {
                    return match[0];
                }
            }

            return null;
        },

        /* --------------------------------------------------------
           IP extraction
        -------------------------------------------------------- */

        extractIPs(line) {
            const ipv4Pattern =
                /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;

            const matches = line.match(ipv4Pattern);

            return matches
                ? [...new Set(matches)]
                : [];
        },

        /* --------------------------------------------------------
           Port extraction
        -------------------------------------------------------- */

        extractPorts(line) {
            const ports = [];

            const patterns = [
                /\bport[=: ]+(\d{1,5})\b/gi,
                /\bdport[=: ]+(\d{1,5})\b/gi,
                /\bsport[=: ]+(\d{1,5})\b/gi
            ];

            patterns.forEach((pattern) => {
                let match;

                while ((match = pattern.exec(line)) !== null) {
                    const port = this.safeNumber(
                        match[1]
                    );

                    if (
                        port >= 0 &&
                        port <= 65535
                    ) {
                        ports.push(port);
                    }
                }
            });

            return [...new Set(ports)];
        },

        /* --------------------------------------------------------
           Severity detection
        -------------------------------------------------------- */

        detectSeverity(line) {
            const value = this.toLower(line);

            if (
                /\b(critical|emergency|emerg|fatal)\b/.test(
                    value
                )
            ) {
                return "critical";
            }

            if (
                /\b(alert|high|severe|error|err)\b/.test(
                    value
                )
            ) {
                return "high";
            }

            if (
                /\b(warn|warning|elevated)\b/.test(
                    value
                )
            ) {
                return "medium";
            }

            if (
                /\b(notice|info|informational)\b/.test(
                    value
                )
            ) {
                return "low";
            }

            return this.config.defaultSeverity;
        },

        /* --------------------------------------------------------
           Event type detection
        -------------------------------------------------------- */

        detectEventType(line) {
            const value = this.toLower(line);

            if (
                /\b(login|authentication|auth|signin)\b/.test(
                    value
                )
            ) {
                return "authentication";
            }

            if (
                /\b(ssh|remote access|rdp)\b/.test(
                    value
                )
            ) {
                return "remote_access";
            }

            if (
                /\b(failed|failure|denied|rejected|blocked)\b/.test(
                    value
                )
            ) {
                return "access_failure";
            }

            if (
                /\b(execute|execution|command|powershell|cmd|shell)\b/.test(
                    value
                )
            ) {
                return "process_execution";
            }

            if (
                /\b(upload|download|transfer|exfil)\b/.test(
                    value
                )
            ) {
                return "data_transfer";
            }

            if (
                /\b(file|created|deleted|modified|changed)\b/.test(
                    value
                )
            ) {
                return "file_activity";
            }

            if (
                /\b(network|connection|connect|socket|traffic)\b/.test(
                    value
                )
            ) {
                return "network_activity";
            }

            if (
                /\b(malware|ransomware|trojan|virus)\b/.test(
                    value
                )
            ) {
                return "malware";
            }

            return "generic";
        },

        /* --------------------------------------------------------
           Username extraction
        -------------------------------------------------------- */

        extractUsername(line) {
            const patterns = [
                /\buser(?:name)?[=: ]+["']?([A-Za-z0-9._@-]+)["']?/i,
                /\baccount[=: ]+["']?([A-Za-z0-9._@-]+)["']?/i,
                /\bprincipal[=: ]+["']?([A-Za-z0-9._@-]+)["']?/i
            ];

            for (const pattern of patterns) {
                const match = line.match(pattern);

                if (match) {
                    return match[1];
                }
            }

            return null;
        },

        /* --------------------------------------------------------
           Hostname extraction
        -------------------------------------------------------- */

        extractHostname(line) {
            const patterns = [
                /\bhost(?:name)?[=: ]+["']?([A-Za-z0-9._-]+)["']?/i,
                /\bserver[=: ]+["']?([A-Za-z0-9._-]+)["']?/i,
                /\bnode[=: ]+["']?([A-Za-z0-9._-]+)["']?/i
            ];

            for (const pattern of patterns) {
                const match = line.match(pattern);

                if (match) {
                    return match[1];
                }
            }

            return null;
        },

        /* --------------------------------------------------------
           Parse one line
        -------------------------------------------------------- */

        parseLine(line, index = 0) {
            const raw = this.normalize(line);

            if (!raw) {
                return null;
            }

            const ips = this.extractIPs(raw);

            return {
                id: `log-${index + 1}`,

                lineNumber: index + 1,

                raw,

                timestamp:
                    this.extractTimestamp(raw),

                sourceIp:
                    ips[0] || null,

                destinationIp:
                    ips.length > 1
                        ? ips[1]
                        : null,

                ips,

                ports:
                    this.extractPorts(raw),

                username:
                    this.extractUsername(raw),

                hostname:
                    this.extractHostname(raw),

                severity:
                    this.detectSeverity(raw),

                eventType:
                    this.detectEventType(raw),

                source:
                    this.config.defaultSource,

                message:
                    raw
            };
        },

        /* --------------------------------------------------------
           Parse raw text
        -------------------------------------------------------- */

        parseText(text) {
            const input = this.normalize(text);

            if (!input) {
                return {
                    records: [],
                    count: 0,
                    errors: []
                };
            }

            const lines = input.split(/\r?\n/);

            const records = [];
            const errors = [];

            const limitedLines =
                lines.slice(0, this.config.maxLines);

            limitedLines.forEach((line, index) => {
                try {
                    const record =
                        this.parseLine(
                            line,
                            index
                        );

                    if (record) {
                        records.push(record);
                    }
                } catch (error) {
                    errors.push({
                        line: index + 1,
                        message: error.message
                    });
                }
            });

            return {
                records,
                count: records.length,
                totalLines: lines.length,
                truncated:
                    lines.length >
                    this.config.maxLines,
                errors
            };
        },

        /* --------------------------------------------------------
           Parse File
        -------------------------------------------------------- */

        async parseFile(file) {
            if (!(file instanceof File)) {
                throw new TypeError(
                    "LogParser.parseFile expects a File object."
                );
            }

            const text =
                await file.text();

            const result =
                this.parseText(text);

            result.file = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified:
                    file.lastModified
            };

            return result;
        },

        /* --------------------------------------------------------
           Parse multiple files
        -------------------------------------------------------- */

        async parseFiles(files) {
            const collection = [];

            for (const file of Array.from(files || [])) {
                try {
                    const result =
                        await this.parseFile(file);

                    collection.push(result);
                } catch (error) {
                    collection.push({
                        records: [],
                        count: 0,
                        errors: [
                            {
                                file: file?.name || "unknown",
                                message: error.message
                            }
                        ]
                    });
                }
            }

            const records = collection.flatMap(
                (result) => result.records || []
            );

            return {
                files: collection,
                records,
                count: records.length
            };
        },

        /* --------------------------------------------------------
           Statistics
        -------------------------------------------------------- */

        summarize(records) {
            const data =
                Array.isArray(records)
                    ? records
                    : [];

            const severity = {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            };

            const eventTypes = {};

            const sourceIPs = new Set();
            const destinationIPs = new Set();

            data.forEach((record) => {
                const level =
                    this.toLower(
                        record.severity
                    );

                if (
                    Object.prototype.hasOwnProperty.call(
                        severity,
                        level
                    )
                ) {
                    severity[level] += 1;
                } else {
                    severity.info += 1;
                }

                const type =
                    record.eventType ||
                    "generic";

                eventTypes[type] =
                    (eventTypes[type] || 0) + 1;

                if (record.sourceIp) {
                    sourceIPs.add(
                        record.sourceIp
                    );
                }

                if (record.destinationIp) {
                    destinationIPs.add(
                        record.destinationIp
                    );
                }
            });

            return {
                total: data.length,

                severity,

                eventTypes,

                uniqueSourceIPs:
                    sourceIPs.size,

                uniqueDestinationIPs:
                    destinationIPs.size,

                threatSignals:
                    severity.critical +
                    severity.high
            };
        },

        /* --------------------------------------------------------
           Filter records
        -------------------------------------------------------- */

        filter(records, options = {}) {
            const data =
                Array.isArray(records)
                    ? records
                    : [];

            const severity =
                options.severity
                    ? this.toLower(options.severity)
                    : null;

            const eventType =
                options.eventType
                    ? this.toLower(options.eventType)
                    : null;

            const sourceIp =
                options.sourceIp
                    ? this.normalize(options.sourceIp)
                    : null;

            return data.filter((record) => {
                if (
                    severity &&
                    this.toLower(record.severity) !==
                    severity
                ) {
                    return false;
                }

                if (
                    eventType &&
                    this.toLower(record.eventType) !==
                    eventType
                ) {
                    return false;
                }

                if (
                    sourceIp &&
                    record.sourceIp !== sourceIp
                ) {
                    return false;
                }

                return true;
            });
        }
    };

    /* ------------------------------------------------------------
       Global API
       ------------------------------------------------------------ */

    window.LogParser = LogParser;

})();