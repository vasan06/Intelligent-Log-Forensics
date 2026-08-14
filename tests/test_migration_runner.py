import tempfile
import unittest
from pathlib import Path

from scripts.run_migrations import expand_includes


class MigrationRunnerTest(unittest.TestCase):
    def test_numbered_migrations_and_parameterized_tracking_exist(self):
        migrations = sorted(Path("database/migrations").glob("*.sql"))
        self.assertEqual([path.name for path in migrations], ["001_initial.sql", "002_add_feedback.sql", "003_add_file_hash.sql", "004_enforce_attack_taxonomy.sql"])
        expanded = expand_includes(migrations[0].read_text(encoding="utf-8"), migrations[0])
        self.assertIn("CREATE TABLE IF NOT EXISTS users", expanded)
        self.assertIn("CREATE INDEX IF NOT EXISTS", expanded)


if __name__ == "__main__":
    unittest.main()
