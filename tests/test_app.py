import io
import tempfile
import unittest
from pathlib import Path

from app import create_app
from app.extensions import db
from config import Config


class TestConfig(Config):
    TESTING = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    temp_dir = tempfile.TemporaryDirectory()
    UPLOAD_FOLDER = str(Path(temp_dir.name) / "uploads")
    REPORT_FOLDER = str(Path(temp_dir.name) / "reports")


class ForensicsAppTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

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
        self.assertIn(b"Authentication Risk", response.data)
        summary = self.client.get("/api/dashboard/summary").get_json()
        self.assertEqual(summary["total_logs"], 4)
        self.assertGreaterEqual(summary["risk_events"], 4)
        sources = self.client.get("/api/dashboard/log-sources").get_json()
        self.assertEqual(sources["Web / API"], 4)
        incidents = self.client.get("/api/incidents/1").get_json()
        self.assertGreaterEqual(len(incidents), 2)

        report = self.client.post("/reports/generate/1")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.mimetype, "application/pdf")
        self.assertTrue(report.data.startswith(b"%PDF"))
        report.close()


if __name__ == "__main__":
    unittest.main()
