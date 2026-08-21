import unittest
from pathlib import Path


class DockerPackagingTest(unittest.TestCase):
    def test_runtime_uses_migrations_single_process_and_named_volumes(self):
        dockerfile = Path("Dockerfile").read_text(encoding="utf-8")
        compose = Path("docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("python scripts/run_migrations.py", dockerfile)
        self.assertIn("--workers 1", dockerfile)
        self.assertIn("uploads_data:/app/instance/uploads", compose)
        self.assertIn("models_data:/app/instance/models", compose)
        self.assertNotIn("instance/uploads:/app/instance/uploads", compose)

    def test_build_context_excludes_secrets_and_runtime_evidence(self):
        ignored = Path(".dockerignore").read_text(encoding="utf-8").splitlines()
        for required in (".env", "instance/uploads/*", "instance/models/*", "instance/reports/*"):
            self.assertIn(required, ignored)
        config = Path("config.py").read_text(encoding="utf-8")
        self.assertIn('os.environ["DATABASE_URL"]', config)
        self.assertIn('os.environ["SECRET_KEY"]', config)


if __name__ == "__main__":
    unittest.main()
