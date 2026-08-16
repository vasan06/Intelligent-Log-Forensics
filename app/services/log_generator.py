import random
from datetime import datetime, timedelta, timezone
from itertools import cycle

from faker import Faker


MODES = ("normal", "scan", "bruteforce", "breach")
SOURCES = ("web", "system", "cloud", "app", "network")
LOG_SOURCE_TYPES = {
    "web": "Web / API",
    "system": "Syslog",
    "cloud": "CloudTrail",
    "app": "Application",
    "network": "Firewall",
}


class LogGenerator:
    """Pure synthetic log producer covering web, system, cloud, app, and
    network sources; it performs no I/O and owns no threads."""

    def __init__(self, seed=42):
        self.random = random.Random(seed)
        self.fake = Faker()
        self.fake.seed_instance(seed)
        self.sequence = 0
        self._normal_routes = cycle((
            ("GET", "/", 200, "Home page loaded"),
            ("GET", "/health", 200, "Health check succeeded"),
            ("GET", "/profile", 200, "Profile retrieved"),
            ("POST", "/api/orders", 201, "Order submitted"),
            ("GET", "/api/catalog", 200, "Catalog response returned"),
        ))
        self._attack_endpoints = {
            "scan": cycle((
                "/admin",
                "/robots.txt",
                "/api/v1/users",
                "/.git/config",
                "/login",
                "/wp-admin",
            )),
            "bruteforce": cycle((
                "/auth/login",
                "/login",
                "/api/auth/session",
            )),
            "breach": cycle((
                "/api/search?q=' UNION SELECT password FROM users--",
                "/api/items?id=1 OR 1=1",
                "/search?q=<script>alert(1)</script>",
                "/download?path=../../etc/passwd",
            )),
        }

    def generate(self, mode="normal", count=100, start=None, source="mixed"):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {', '.join(MODES)}")
        if source != "mixed" and source not in SOURCES:
            raise ValueError(f"source must be 'mixed' or one of {', '.join(SOURCES)}")
        sources = cycle(SOURCES) if source == "mixed" else cycle((source,))
        start = start or datetime.now(timezone.utc).replace(tzinfo=None)
        return [self._record(mode, start + timedelta(milliseconds=i * 180), next(sources)) for i in range(count)]

    # ----- shared scaffolding -------------------------------------------------

    def _record(self, mode, timestamp, source):
        self.sequence += 1
        attacker = {"scan": "198.51.100.20", "bruteforce": "203.0.113.44", "breach": "192.0.2.66"}.get(mode)
        user = self.fake.user_name()
        record = {
            "timestamp": timestamp,
            "source_ip": attacker or self.fake.ipv4_private(),
            "destination_ip": self.fake.ipv4_public() if attacker else "10.10.20.15",
            "destination_port": 443,
            "user_identifier": user,
            "generator_mode": mode,
            "generator_source": source,
            "user_agent": self.fake.user_agent(),
        }
        builder = getattr(self, f"_{source}_record")
        builder(record, mode, timestamp, attacker, user)
        record["raw_log"] = " ".join(f"{key}={value}" for key, value in record.items() if key != "raw_log" and value is not None)
        record["log_source_type"] = LOG_SOURCE_TYPES[source]
        record["is_valid"] = True
        return record

    def _normal_request(self):
        return next(self._normal_routes)

    # ----- web / api ----------------------------------------------------------

    def _web_record(self, record, mode, timestamp, attacker, user):
        method, endpoint, status, message = self._normal_request()
        record.update(
            method=method,
            endpoint=endpoint,
            status_code=status,
            response_time=round(self.random.uniform(35, 260), 2),
            event_type="request",
            level="INFO",
            message=message,
            http_status_reason="OK",
            referrer=self.random.choice(("https://portal.example/app", "https://portal.example/home", None)),
        )
        if mode == "scan":
            probe = next(self._attack_endpoints["scan"])
            status_code = self.random.choice((404, 404, 404, 429))
            record.update(
                method="GET",
                endpoint=probe,
                status_code=status_code,
                response_time=round(self.random.uniform(12, 110), 2),
                message=f"Unknown route probe against {probe}",
                event_type="route_probe",
                level="WARN",
                http_status_reason="Not Found" if status_code == 404 else "Too Many Requests",
            )
        elif mode == "bruteforce":
            status_code = self.random.choice((401, 401, 401, 403, 200))
            record.update(
                method="POST",
                endpoint=next(self._attack_endpoints["bruteforce"]),
                status_code=status_code,
                response_time=round(self.random.uniform(55, 220), 2),
                message=self._bruteforce_message(user, status_code),
                event_type="authentication",
                level="WARN" if status_code != 200 else "INFO",
                http_status_reason="Unauthorized" if status_code == 401 else ("Forbidden" if status_code == 403 else "OK"),
            )
        elif mode == "breach":
            endpoint = next(self._attack_endpoints["breach"])
            status_code = self.random.choice((500, 500, 503, 429))
            record.update(
                method=self.random.choice(("GET", "POST")),
                endpoint=endpoint,
                status_code=status_code,
                response_time=self.random.choice((620.0, 880.0, 1800.0)),
                level="ERROR",
                event_type="attack",
                message=self._breach_message(endpoint),
                http_status_reason="Internal Server Error",
                sql_payload=endpoint if "union select" in endpoint.lower() else None,
            )

    # ----- system / syslog -----------------------------------------------------

    def _system_record(self, record, mode, timestamp, attacker, user):
        record["destination_port"] = 22
        record["user_agent"] = None
        if mode == "normal":
            template = self.random.choice((
                ("sshd", "Accepted password for {user} from {ip} port 51234 ssh2", "INFO", "authentication"),
                ("systemd", "Started {unit} service.", "INFO", "service"),
                ("sudo", "user : TTY=pts/0 ; PWD=/home ; USER=root ; COMMAND=/bin/systemctl restart nginx", "INFO", "command"),
                ("kernel", "eth0: link up, 1000Mbps, full-duplex", "INFO", "kernel"),
                ("cron", "(root) CMD (/usr/local/bin/logrotate /etc/logrotate.conf)", "INFO", "scheduler"),
            ))
            program, message, level, event_type = template
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                program=program, event_type=event_type, level=level,
                message=message.format(user=user, ip=record["source_ip"], unit=self.fake.word()),
            )
        elif mode == "scan":
            message = "sshd[{pid}]: Failed password for invalid user {probe} from {ip} port {port} ssh2".format(
                pid=self.random.randint(1000, 9999), probe=next(self._attack_endpoints["scan"]).strip("/").replace("/", "_"),
                ip=record["source_ip"], port=self.random.randint(20000, 59999))
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                program="sshd", event_type="route_probe", level="WARN", message=message,
            )
        elif mode == "bruteforce":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                program="sshd", event_type="authentication", level="WARN",
                message="sshd[{pid}]: Failed password for {user} from {ip} port {port} ssh2".format(
                    pid=self.random.randint(1000, 9999), user=user, ip=record["source_ip"], port=self.random.randint(20000, 59999)),
            )
        elif mode == "breach":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                program="sudo", event_type="attack", level="CRITICAL",
                message="sudo: {user} : command not allowed ; COMMAND=/bin/cat /etc/shadow ; TTY=pts/1 ; USER=root".format(user=user),
                sudo_denied=True,
            )

    # ----- cloud / cloudtrail ---------------------------------------------------

    def _cloud_record(self, record, mode, timestamp, attacker, user):
        record["destination_port"] = 443
        record["user_agent"] = None
        record["event_source"] = self.random.choice(("s3.amazonaws.com", "ec2.amazonaws.com", "iam.amazonaws.com", "cloudtrail.amazonaws.com"))
        record["aws_region"] = self.random.choice(("us-east-1", "eu-west-1", "ap-southeast-2"))
        if mode == "normal":
            event_name = self.random.choice(("GetObject", "PutObject", "DescribeInstances", "AssumeRole", "ListBuckets"))
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type=event_name, level="INFO",
                message=f"{event_name} call authorized for arn:aws:sts::{self.fake.random_number(6)}::assumed-role/{user}",
            )
        elif mode == "scan":
            event_name = self.random.choice(("GetCallerIdentity", "DescribeInstances", "DescribeSecurityGroups"))
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type=event_name, level="WARN",
                message=f"Repeated {event_name} enumeration from {record['source_ip']} without authorized policy",
            )
        elif mode == "bruteforce":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type="ConsoleLogin", level="WARN",
                message=f"ConsoleLogin failed for {user}: AccessDenied - invalid client token from {record['source_ip']}",
            )
        elif mode == "breach":
            event_name = self.random.choice(("PutBucketPolicy", "DeleteBucket", "PutBucketAcl", "AuthorizeSecurityGroupIngress"))
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type=event_name, level="CRITICAL",
                message=f"Privileged {event_name} issued by arn:aws:iam::aws:user/{user} - policy may expose resources",
            )

    # ----- application ----------------------------------------------------------

    def _app_record(self, record, mode, timestamp, attacker, user):
        record["referrer"] = None
        record["destination_port"] = 5432
        if mode == "normal":
            template = self.random.choice((
                ("transaction", "INFO", "Order {oid} committed to Postgres in {ms}ms"),
                ("cache", "INFO", "Cache hit for product:{pid}"),
                ("queue", "INFO", "Message {mid} enqueued on orders.dlq"),
                ("payment", "INFO", "Payment authorization succeeded for order {oid}"),
            ))
            event_type, level, pattern = template
            record.update(
                method=None, endpoint=None, status_code=None,
                response_time=round(self.random.uniform(40, 240), 2),
                event_type=event_type, level=level,
                message=pattern.format(oid=self.fake.random_number(5), pid=self.random.randint(1, 9999),
                                       mid=self.fake.uuid4()[:12], ms=self.random.randint(40, 240)),
            )
        elif mode == "scan":
            probe = next(self._attack_endpoints["scan"])
            record.update(
                method=None, endpoint=None, status_code=404,
                response_time=round(self.random.uniform(10, 90), 2),
                event_type="route_probe", level="WARN",
                message=f"Application gateway rejected unknown route {probe}",
            )
        elif mode == "bruteforce":
            record.update(
                method=None, endpoint=None, status_code=None,
                response_time=round(self.random.uniform(60, 300), 2),
                event_type="authentication", level="WARN",
                message=f"Authentication failed for {user}: bad credentials",
            )
        elif mode == "breach":
            endpoint = next(self._attack_endpoints["breach"])
            record.update(
                method=None, endpoint=None, status_code=500,
                response_time=self.random.choice((700.0, 1200.0, 2400.0)),
                event_type="attack", level="ERROR",
                message=f"Unhandled exception while processing payload on {endpoint}: org.postgresql.util.PSQLException",
                sql_payload=endpoint if "union select" in endpoint.lower() else None,
            )

    # ----- network / firewall ---------------------------------------------------

    def _network_record(self, record, mode, timestamp, attacker, user):
        record["destination_port"] = self.random.choice((53, 443, 22, 3306))
        record["user_agent"] = None
        if mode == "normal":
            action = self.random.choice(("ACCEPT", "ACCEPT", "ACCEPT", "ESTABLISHED"))
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type="firewall", level="INFO",
                message=f"{action} packet SRC={record['source_ip']} DST={record['destination_ip']} DPT={record['destination_port']} LEN=52",
            )
        elif mode == "scan":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type="firewall", level="WARN",
                message="Dropped TCP packet SRC={src} DST={dst} DPT={dpt} SYN,ACK window scan behavior".format(
                    src=record["source_ip"], dst=record["destination_ip"], dpt=self.random.choice((4444, 5555, 6666, 22))),
            )
        elif mode == "bruteforce":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type="firewall", level="WARN",
                message="Dropped TCP packet SRC={src} DST={dst} DPT={dpt} SYN flood burst from single host".format(
                    src=record["source_ip"], dst=record["destination_ip"], dpt=self.random.choice((22, 3389, 3306))),
            )
        elif mode == "breach":
            record.update(
                method=None, endpoint=None, status_code=None, response_time=None,
                event_type="firewall", level="CRITICAL",
                message="ALERT: exfiltration traffic SRC={src} DST={dst} DPT=53 QUERY=exfil.example.com LEN=1500 beyond policy".format(
                    src=record["source_ip"], dst=record["destination_ip"]),
            )

    # ----- messages -------------------------------------------------------------

    def _bruteforce_message(self, user, status_code):
        if status_code == 200:
            return f"Successful login for {user}"
        if status_code == 403:
            return f"Login denied for {user}; account protection triggered"
        return f"Invalid password for {user}"

    def _breach_message(self, endpoint):
        if "union select" in endpoint.lower():
            return "SQL injection attempt detected with UNION SELECT syntax"
        if "script" in endpoint.lower():
            return "Cross-site scripting payload detected in search parameter"
        if "../" in endpoint:
            return "Path traversal attempt against restricted file path"
        return "Suspicious payload submitted"


def generate_labeled_dataset(samples_per_mode=250, seed=42):
    generator = LogGenerator(seed)
    rows = []
    base_time = datetime(2025, 1, 1, 0, 0, 0)
    mode_window = timedelta(milliseconds=samples_per_mode * 180, seconds=1)
    for index, mode in enumerate(MODES):
        rows.extend(generator.generate(mode, samples_per_mode, start=base_time + index * mode_window))
    return rows


def generate_multi_source_dataset(samples_per_mode=120, seed=42):
    """Span the runtime schema across all five log source categories."""
    generator = LogGenerator(seed)
    rows = []
    base_time = datetime(2025, 1, 1, 0, 0, 0)
    mode_window = timedelta(milliseconds=samples_per_mode * len(SOURCES) * 180, seconds=1)
    for index, mode in enumerate(MODES):
        for source_index, source in enumerate(SOURCES):
            start = base_time + index * mode_window + source_index * timedelta(milliseconds=samples_per_mode * 180)
            rows.extend(generator.generate(mode, samples_per_mode, start=start, source=source))
    return rows
