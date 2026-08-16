import argparse
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "database/migrations"


def expand_includes(sql, migration_path):
    lines = []
    for line in sql.splitlines():
        if line.strip().startswith("\\ir "):
            included = (migration_path.parent / line.strip()[4:].strip()).resolve()
            lines.append(included.read_text(encoding="utf-8"))
        else:
            lines.append(line)
    return "\n".join(lines)


def run(dsn, migrations=MIGRATIONS):
    dsn = dsn.replace("postgresql+psycopg2://", "postgresql://", 1)
    with psycopg2.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)")
            cursor.execute("SELECT name FROM schema_migrations")
            applied = {row[0] for row in cursor.fetchall()}
            for path in sorted(migrations.glob("[0-9][0-9][0-9]_*.sql")):
                if path.name in applied:
                    continue
                cursor.execute(expand_includes(path.read_text(encoding="utf-8"), path))
                cursor.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))
                print(f"Applied {path.name}")


def main():
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url:
        parser.error("DATABASE_URL is required")
    run(args.database_url)


if __name__ == "__main__":
    main()
