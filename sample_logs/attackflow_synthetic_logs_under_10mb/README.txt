# AttackFlow-Lite Synthetic Multi-Source Log Dataset

Total logs: 1351

This dataset is fully synthetic and created for academic testing of the project:
AttackFlow-Lite: Intelligent Application Log Forensics and MITRE ATT&CK-Based Risk Mapping System.

## Included files

1. attackflow_combined_logs.log  - mixed custom human-readable log format
2. attackflow_combined_logs.json - JSON array format
3. attackflow_combined_logs.jsonl - one JSON object per line
4. attackflow_combined_logs.csv  - normalized tabular format
5. dataset_summary.json          - count summary

## Sources included

{
  "api": 497,
  "web": 273,
  "auth": 171,
  "system": 155,
  "unknown": 25,
  "frontend": 85,
  "database": 80,
  "network": 65
}

## Risk labels included

{
  "safe": 586,
  "security_risk": 225,
  "api_route_risk": 100,
  "auth_risk": 107,
  "performance_risk": 105,
  "frontend_runtime_risk": 85,
  "system_risk": 63,
  "database_risk": 59,
  "network_risk": 21
}

## Example use cases

- Multi-format log upload testing
- Log parser testing
- Log normalization testing
- Data quality score testing
- ML Safe / Warning / Risk classification
- Application health analysis
- API route failure detection
- Authentication risk detection
- Frontend runtime error forensics
- Performance degradation analytics
- MITRE ATT&CK mapping for selected synthetic security events
- PDF forensic report generation

## Important note

This is not real company log data. It is synthetic and safe for academic demonstration.
