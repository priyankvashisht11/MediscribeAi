# backend/app/services/icd_lookup.py

import sqlite3
import logging
from app.config import settings

logger = logging.getLogger(__name__)


def search_icd10(query: str, limit: int = 5) -> list[dict]:
    """Search ICD-10 codes by description keyword. Returns [{code, description, category}]."""
    if not query or len(query.strip()) < 2:
        return []
    try:
        conn = sqlite3.connect(settings.icd_db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(
            """
            SELECT code, description, category FROM icd10
            WHERE LOWER(description) LIKE LOWER(?)
               OR LOWER(category) LIKE LOWER(?)
            LIMIT ?
            """,
            (f"%{query}%", f"%{query}%", limit),
        )
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"ICD-10 lookup error for '{query}': {e}")
        return []


def get_icd10_by_code(code: str) -> dict | None:
    """Fetch a single ICD-10 entry by exact code."""
    try:
        conn = sqlite3.connect(settings.icd_db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT code, description, category FROM icd10 WHERE code = ?", (code,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        logger.error(f"ICD-10 code lookup error for '{code}': {e}")
        return None
