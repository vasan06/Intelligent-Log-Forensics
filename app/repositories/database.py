import os
from contextlib import contextmanager

import psycopg2
from flask import current_app, g
from psycopg2.extras import RealDictCursor


def _dsn():
    configured = current_app.config.get("DATABASE_URL") if current_app else None
    return (configured or os.environ["DATABASE_URL"]).replace(
        "postgresql+psycopg2://", "postgresql://", 1
    )


def connection():
    if "database_connection" not in g:
        g.database_connection = psycopg2.connect(_dsn(), cursor_factory=RealDictCursor)
    return g.database_connection


def close_connection(_error=None):
    database_connection = g.pop("database_connection", None)
    if database_connection is not None:
        database_connection.close()


@contextmanager
def transaction():
    database_connection = connection()
    try:
        yield database_connection
        database_connection.commit()
    except Exception:
        database_connection.rollback()
        raise


def fetch_one(query, params=()):
    with connection().cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchone()


def fetch_all(query, params=()):
    with connection().cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


def execute(query, params=(), *, cursor=None):
    if cursor is not None:
        cursor.execute(query, params)
        return cursor.fetchone() if cursor.description else None
    with transaction() as database_connection:
        with database_connection.cursor() as owned_cursor:
            owned_cursor.execute(query, params)
            return owned_cursor.fetchone() if owned_cursor.description else None
