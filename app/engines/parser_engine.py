import csv
import json
import re
from pathlib import Path


LOG_PATTERN = re.compile(
    r'(?P<ip>\d{1,3}(?:\.\d{1,3}){3})\s+\S+\s+\S+\s+\[(?P<timestamp>[^\]]+)\]\s+'
    r'"(?P<method>[A-Z]+)\s+(?P<endpoint>\S+)(?:\s+HTTP/\S+)?"\s+'
    r"(?P<status>\d{3})(?:\s+\S+)?(?:\s+(?P<response_time>\d+(?:\.\d+)?))?"
)


def parse_file(file_path):
    path = Path(file_path)
    extension = path.suffix.lower()
    if extension == ".csv":
        return _parse_csv(path)
    if extension == ".json":
        return _parse_json(path)
    return _parse_text(path)


def _parse_csv(path):
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _parse_json(path):
    with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return [item if isinstance(item, dict) else {"message": str(item)} for item in data]
    if isinstance(data, dict):
        for key in ("logs", "events", "records", "data"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    return [{"message": str(data)}]


def _parse_text(path):
    records = []
    with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
                records.append(parsed if isinstance(parsed, dict) else {"message": raw})
                continue
            except json.JSONDecodeError:
                pass
            match = LOG_PATTERN.search(raw)
            if match:
                record = match.groupdict()
                record["raw_log"] = raw
                records.append(record)
            else:
                records.append(_parse_key_value_line(raw))
    return records


def _parse_key_value_line(raw):
    record = {"raw_log": raw, "message": raw}
    for key, value in re.findall(r"([\w.-]+)=('[^']*'|\"[^\"]*\"|\S+)", raw):
        record[key] = value.strip("'\"")
    timestamp_match = re.match(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+)\s+(?P<level>[A-Z]+)?\s*(?P<message>.*)",
        raw,
    )
    if timestamp_match:
        record.update({k: v for k, v in timestamp_match.groupdict().items() if v})
    return record

