import random
from datetime import datetime, timedelta, timezone

from faker import Faker


MODES = ("normal", "scan", "bruteforce", "breach")


class LogGenerator:
    """Pure synthetic log producer; it performs no I/O and owns no threads."""

    def __init__(self, seed=42):
        self.random = random.Random(seed)
        self.fake = Faker()
        self.fake.seed_instance(seed)
        self.sequence = 0

    def generate(self, mode="normal", count=100, start=None):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {', '.join(MODES)}")
        start = start or datetime.now(timezone.utc).replace(tzinfo=None)
        return [self._record(mode, start + timedelta(milliseconds=i * 180)) for i in range(count)]

    def _record(self, mode, timestamp):
        self.sequence += 1
        normal_ip = self.fake.ipv4_private()
        attacker = {"scan": "198.51.100.20", "bruteforce": "203.0.113.44", "breach": "192.0.2.66"}.get(mode)
        record = {
            "timestamp": timestamp,
            "source_ip": attacker or normal_ip,
            "user_identifier": self.fake.user_name(),
            "method": "GET",
            "endpoint": self.random.choice(("/", "/api/orders", "/profile", "/health")),
            "status_code": 200,
            "response_time": round(self.random.uniform(35, 260), 2),
            "event_type": "request",
            "level": "INFO",
            "message": "Request completed",
            "generator_mode": mode,
        }
        if mode == "scan":
            record.update(endpoint=f"/admin/probe-{self.sequence % 18}", status_code=404, message="Unknown route probe")
        elif mode == "bruteforce":
            record.update(method="POST", endpoint="/auth/login", status_code=401, message="Invalid password")
        elif mode == "breach":
            record.update(method="POST", endpoint="/api/search?q=' UNION SELECT password FROM users", status_code=500, response_time=1800, level="ERROR", message="SQL injection breach indicator")
        record["raw_log"] = " ".join(f"{key}={value}" for key, value in record.items() if key != "raw_log")
        record["log_source_type"] = "Web / API"
        record["is_valid"] = True
        return record


def generate_labeled_dataset(samples_per_mode=250, seed=42):
    generator = LogGenerator(seed)
    rows = []
    base_time = datetime(2025, 1, 1, 0, 0, 0)
    mode_window = timedelta(milliseconds=samples_per_mode * 180, seconds=1)
    for index, mode in enumerate(MODES):
        rows.extend(generator.generate(mode, samples_per_mode, start=base_time + index * mode_window))
    return rows
