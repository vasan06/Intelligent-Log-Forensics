import os
import uuid

import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from run_migrations import ROOT, run


def main():
    load_dotenv(ROOT / ".env")
    source = os.environ["DATABASE_URL"].replace("postgresql+psycopg2://", "postgresql://", 1)
    parsed = psycopg2.extensions.parse_dsn(source)
    admin = dict(parsed)
    admin["dbname"] = "postgres"
    database_name = f"forensics_migration_test_{uuid.uuid4().hex[:10]}"
    connection = psycopg2.connect(**admin)
    connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    try:
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE "{database_name}"')
        test_dsn = dict(parsed)
        test_dsn["dbname"] = database_name
        run(psycopg2.extensions.make_dsn(**test_dsn))
        run(psycopg2.extensions.make_dsn(**test_dsn))
        with psycopg2.connect(**test_dsn) as test_connection:
            with test_connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM schema_migrations")
                assert cursor.fetchone()[0] == 4
                cursor.execute("INSERT INTO uploaded_files (user_id, file_name, stored_name, file_type, file_size) SELECT id, 'proof.log', 'proof.log', 'log', 1 FROM users ORDER BY id LIMIT 1 RETURNING id")
                inserted = cursor.fetchone()
                if inserted is None:
                    cursor.execute("INSERT INTO users (name,email,password_hash) VALUES (%s,%s,%s) RETURNING id", ("Migration Test", "migration-test@example.invalid", "not-a-login-secret"))
                    user_id = cursor.fetchone()[0]
                    cursor.execute("INSERT INTO uploaded_files (user_id,file_name,stored_name,file_type,file_size) VALUES (%s,%s,%s,%s,%s)", (user_id, "proof.log", "proof.log", "log", 1))
        run(psycopg2.extensions.make_dsn(**test_dsn))
        with psycopg2.connect(**test_dsn) as test_connection:
            with test_connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM uploaded_files WHERE file_name=%s", ("proof.log",))
                assert cursor.fetchone()[0] == 1
        print("Fresh, idempotent, and populated-data migration validation: OK")
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s", (database_name,))
            cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}"')
        connection.close()


if __name__ == "__main__":
    main()
