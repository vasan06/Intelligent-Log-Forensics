import io
import os
import tempfile
import unittest
import uuid
import time
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from app import create_app
from config import Config
from scripts.run_migrations import run
from app.knowledge_base.taxonomy import load_taxonomy
from app.engines.feature_engine import extract_feature_rows
from app.engines.ml_engine import train
from app.services.log_generator import LogGenerator
from scripts.retrain_model import retrain


class TestConfig(Config):
    TESTING = True
    WTF_CSRF_ENABLED = False
    temp_dir = tempfile.TemporaryDirectory()
    UPLOAD_FOLDER = str(Path(temp_dir.name) / "uploads")
    REPORT_FOLDER = str(Path(temp_dir.name) / "reports")
    MODEL_FOLDER = str(Path(temp_dir.name) / "models")
    MODEL_PATH = str(Path(MODEL_FOLDER) / "test-ensemble.joblib")
    GENERATOR_INTERVAL_SECONDS = 0.05
    GENERATOR_BATCH_SIZE = 6


class ForensicsAppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        source = os.environ["DATABASE_URL"].replace("postgresql+psycopg2://", "postgresql://", 1)
        cls.parsed = psycopg2.extensions.parse_dsn(source)
        admin = dict(cls.parsed)
        admin["dbname"] = "postgres"
        cls.database_name = f"forensics_app_test_{uuid.uuid4().hex[:10]}"
        cls.admin_connection = psycopg2.connect(**admin)
        cls.admin_connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        with cls.admin_connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE "{cls.database_name}"')
        test_dsn = dict(cls.parsed)
        test_dsn["dbname"] = cls.database_name
        TestConfig.DATABASE_URL = psycopg2.extensions.make_dsn(**test_dsn)
        run(TestConfig.DATABASE_URL)
        normal_features = extract_feature_rows(LogGenerator().generate("normal", 120))
        train(normal_features, TestConfig.MODEL_PATH, contamination=0.05)

    @classmethod
    def tearDownClass(cls):
        with cls.admin_connection.cursor() as cursor:
            cursor.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s", (cls.database_name,))
            cursor.execute(f'DROP DATABASE IF EXISTS "{cls.database_name}"')
        cls.admin_connection.close()
        TestConfig.temp_dir.cleanup()

    def setUp(self):
        with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute("TRUNCATE reports, incident_events, incidents, mitre_mappings, risk_events, data_quality_results, normalized_logs, uploaded_files, model_retraining_runs, users RESTART IDENTITY CASCADE")
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    def tearDown(self):
        self.app.extensions["live_generator"].stop()
        self.client = None

    def login(self):
        return self.client.post(
            "/auth/login",
            data={"email": "analyst@example.com", "password": "analyst123"},
            follow_redirects=True,
        )

    def test_login_and_dashboard(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Forensic overview", response.data)

    def test_account_registration_and_attack_intelligence(self):
        response = self.client.post(
            "/auth/register",
            data={"name": "New Analyst", "email": "new@example.com", "password": "StrongPass42"},
            follow_redirects=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Forensic overview", response.data)
        guide = self.client.get("/attack-intelligence")
        self.assertIn(b"Detection is a hypothesis", guide.data)
        detail = self.client.get("/attack-intelligence/sql-injection")
        self.assertEqual(detail.status_code, 200)
        self.assertIn(b"How attackers implement it", detail.data)
        self.assertIn(b"Defense by approach", detail.data)

    def test_full_upload_pipeline(self):
        self.login()
        csv_data = (
            b"timestamp,source_ip,method,endpoint,status_code,response_time,message\n"
            b"2026-07-01T10:00:00,203.0.113.10,POST,/auth/login,401,120,Invalid password\n"
            b"2026-07-01T10:00:03,203.0.113.10,POST,/auth/login,401,125,Invalid password\n"
            b"2026-07-01T10:00:06,203.0.113.10,POST,/auth/login,401,121,Invalid password\n"
            b"2026-07-01T10:02:00,10.0.0.2,GET,/api/orders,500,900,Server failure\n"
        )
        response = self.client.post(
            "/upload",
            data={"log_file": (io.BytesIO(csv_data), "evidence.csv")},
            content_type="multipart/form-data",
            follow_redirects=True,
        )
        self.assertEqual(response.status_code, 200)
        analysis = self.client.get("/api/v1/uploads/1").get_json()
        self.assertTrue(any("Authentication Risk" in risk["risk_category"] for risk in analysis["risks"]))
        self.assertGreaterEqual(analysis["forensic_trust"]["score"], 0)
        self.assertIn("rule_ml_agreement", analysis["forensic_trust"]["formula"])
        self.assertNotIn(b"evidence.csv", response.data)
        history_page = self.client.get("/upload/history")
        self.assertNotIn(b"evidence.csv", history_page.data)
        self.assertEqual(self.client.get("/api/v1/uploads").get_json()[0]["file_name"], "evidence.csv")
        summary = self.client.get("/api/v1/dashboard/summary").get_json()
        self.assertEqual(summary["total_logs"], 4)
        self.assertGreaterEqual(summary["risk_events"], 4)
        sources = self.client.get("/api/v1/dashboard/log-sources").get_json()
        self.assertEqual(sources["Web / API"], 4)
        incidents = self.client.get("/api/v1/incidents/1").get_json()
        self.assertGreaterEqual(len(incidents["incidents"]), 2)
        with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT attack_type, source_status, source FROM risk_events")
                tagged = cursor.fetchall()
        self.assertTrue(tagged)
        self.assertTrue(all(attack_type in load_taxonomy() for attack_type, _, _ in tagged))
        self.assertTrue(all(source_status == "uploaded" for _, source_status, _ in tagged))
        self.assertIn("ml", {source for _, _, source in tagged})
        self.assertEqual([path.name for path in Path(TestConfig.UPLOAD_FOLDER).iterdir()], [])
        trends = self.client.get("/api/v1/dashboard/error-trends").get_json()
        self.assertIn("2026-07-01", trends["labels"])

        report = self.client.post("/reports/generate/1")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.mimetype, "application/pdf")
        self.assertTrue(report.data.startswith(b"%PDF"))
        report.close()

    def test_all_supported_formats_use_one_pipeline_and_cleanup(self):
        self.login()
        samples = {
            "evidence.csv": b"timestamp,source_ip,method,endpoint,status_code,response_time,message\n2026-07-02T10:00:00,203.0.113.8,POST,/auth/login,401,90,Invalid password\n",
            "evidence.json": b'[{"timestamp":"2026-07-02T10:00:01","source_ip":"203.0.113.9","method":"GET","endpoint":"/missing","status_code":404,"message":"probe"}]',
            "evidence.txt": b"2026-07-02T10:00:02 ERROR source_ip=203.0.113.10 status_code=500 endpoint=/api/orders response_time=800 message='failure'\n",
            "evidence.log": b'203.0.113.11 - - [02/Jul/2026:10:00:03 +0000] "GET /health HTTP/1.1" 200 10 45\n',
        }
        for filename, payload in samples.items():
            response = self.client.post("/upload", data={"log_file": (io.BytesIO(payload), filename)}, content_type="multipart/form-data", follow_redirects=True)
            self.assertEqual(response.status_code, 200, filename)
            self.assertEqual([path.name for path in Path(TestConfig.UPLOAD_FOLDER).iterdir()], [], filename)
        with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT file_type,total_records,content_hash,stored_name FROM uploaded_files ORDER BY id")
                rows = cursor.fetchall()
        self.assertEqual({row[0] for row in rows}, {"csv", "json", "txt", "log"})
        self.assertTrue(all(row[1] == 1 and len(row[2]) == 64 for row in rows))
        self.assertTrue(all(row[3].startswith(f"{index}_") for index, row in enumerate(rows, 1)))

    def test_live_generator_is_background_in_memory_and_uses_shared_pipeline(self):
        self.login()
        before = {path.name for path in Path(TestConfig.UPLOAD_FOLDER).iterdir()}
        response = self.client.post("/api/v1/generator/start", json={"mode": "bruteforce"})
        self.assertEqual(response.status_code, 202)
        deadline, count = time.time() + 5, 0
        while time.time() < deadline and count == 0:
            with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM risk_events WHERE source_status=%s", ("auto_generated",))
                    count = cursor.fetchone()[0]
            if count == 0:
                time.sleep(0.05)
        stopped = self.client.post("/api/v1/generator/stop")
        self.assertEqual(stopped.status_code, 200)
        self.assertGreater(count, 0)
        self.assertEqual(before, {path.name for path in Path(TestConfig.UPLOAD_FOLDER).iterdir()})
        self.assertFalse(self.app.extensions["live_generator"].running)

    def test_live_generator_rejects_unknown_mode(self):
        self.login()
        response = self.client.post("/api/v1/generator/start", json={"mode": "invalid"})
        self.assertEqual(response.status_code, 400)

    def test_feedback_labels_and_multiple_measured_retraining_cycles(self):
        self.login()
        payload = (b"timestamp,source_ip,method,endpoint,status_code,response_time,message\n"
                   b"2026-07-03T10:00:00,203.0.113.40,POST,/auth/login,401,100,Invalid password\n"
                   b"2026-07-03T10:00:01,203.0.113.40,POST,/auth/login,401,105,Invalid password\n")
        response = self.client.post("/upload", data={"log_file": (io.BytesIO(payload), "feedback.csv")}, content_type="multipart/form-data", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id FROM risk_events ORDER BY id LIMIT 2")
                risk_ids = [row[0] for row in cursor.fetchall()]
        self.assertGreaterEqual(len(risk_ids), 2)
        first = self.client.post(f"/api/v1/risk-events/{risk_ids[0]}/label", json={"label": "confirmed"})
        self.assertEqual(first.status_code, 200)
        with self.app.app_context():
            run_one = retrain(TestConfig.MODEL_PATH, TestConfig.MODEL_FOLDER)
        second = self.client.post(f"/api/v1/risk-events/{risk_ids[1]}/label", json={"label": "false_positive"})
        self.assertEqual(second.status_code, 200)
        with self.app.app_context():
            run_two = retrain(TestConfig.MODEL_PATH, TestConfig.MODEL_FOLDER)
        series = self.client.get("/api/v1/model/labels-vs-f1").get_json()
        self.assertEqual([point["label_count"] for point in series], [1, 2])
        self.assertTrue(all(0 <= point["f1_score"] <= 1 for point in series))
        self.assertIsNotNone(run_one["old_f1"])
        self.assertIsNotNone(run_two["old_f1"])

    def test_feedback_rejects_invalid_label(self):
        self.login()
        response = self.client.post("/api/v1/risk-events/1/label", json={"label": "maybe"})
        self.assertEqual(response.status_code, 400)

    def test_jwt_cookie_login_refresh_and_same_origin_policy(self):
        response = self.client.post("/api/v1/auth/login", json={"email": "analyst@example.com", "password": "analyst123"})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertNotIn("access_token", body)
        self.assertNotIn("refresh_token", body)
        cookies = "\n".join(response.headers.getlist("Set-Cookie"))
        self.assertIn("access_token_cookie=", cookies)
        self.assertIn("refresh_token_cookie=", cookies)
        self.assertIn("HttpOnly", cookies)
        csrf = self.client.get_cookie("csrf_refresh_token")
        self.assertIsNotNone(csrf)
        refreshed = self.client.post("/api/v1/auth/refresh", headers={"X-CSRF-TOKEN": csrf.value})
        self.assertEqual(refreshed.status_code, 200)
        denied = self.client.get("/api/v1/dashboard/summary", headers={"Origin": "https://evil.example"})
        self.assertEqual(denied.status_code, 403)
        allowed = self.client.get("/api/v1/dashboard/summary", headers={"Origin": TestConfig.APP_ORIGIN})
        self.assertEqual(allowed.headers.get("Access-Control-Allow-Origin"), TestConfig.APP_ORIGIN)

    def test_jwt_login_rejects_bad_credentials_without_secret_leak(self):
        response = self.client.post("/api/v1/auth/login", json={"email": "analyst@example.com", "password": "wrong"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(self.app.config["JWT_SECRET_KEY"].encode(), response.data)

    def test_modified_copy_has_different_sha256(self):
        self.login()
        header = b"timestamp,source_ip,status_code,message\n"
        for suffix in (b"original", b"modified"):
            payload = header + b"2026-07-04T10:00:00,10.0.0.2,200," + suffix + b"\n"
            response = self.client.post("/upload", data={"log_file": (io.BytesIO(payload), "same-name.csv")}, content_type="multipart/form-data")
            self.assertEqual(response.status_code, 302)
        with psycopg2.connect(TestConfig.DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT content_hash FROM uploaded_files ORDER BY id")
                hashes = [row[0] for row in cursor.fetchall()]
        self.assertEqual(len(hashes), 2)
        self.assertNotEqual(hashes[0], hashes[1])

    def test_sse_endpoint_is_authenticated_and_starts_stream(self):
        unauthorized = self.client.get("/api/v1/stream/live")
        self.assertEqual(unauthorized.status_code, 302)
        self.login()
        response = self.client.get("/api/v1/stream/live", buffered=False)
        self.assertEqual(response.mimetype, "text/event-stream")
        self.assertEqual(next(response.response), b"retry: 2000\n\n")
        response.close()


if __name__ == "__main__":
    unittest.main()
