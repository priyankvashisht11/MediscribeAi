#!/usr/bin/env python3
"""
Safe production migration runner.

If the alembic_version table doesn't exist (DB was created outside Alembic),
stamps at the last known baseline (0003) before upgrading to head.
This prevents Alembic from trying to recreate tables that already exist.
"""
import asyncio
import os
import subprocess
import sys


async def get_current_revision() -> str | None:
    import asyncpg

    url = os.environ.get("DATABASE_URL", "")
    # asyncpg needs postgresql:// scheme, not postgresql+asyncpg://
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    try:
        conn = await asyncpg.connect(url, ssl="require")
    except Exception:
        # Retry without SSL requirement (some setups use sslmode in URL)
        conn = await asyncpg.connect(url)

    try:
        table_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')"
        )
        if not table_exists:
            return None
        row = await conn.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
        return row
    finally:
        await conn.close()


def run(cmd: list[str]) -> None:
    print(f">> {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(result.returncode)


async def main() -> None:
    print("Checking current Alembic revision...", flush=True)
    rev = await get_current_revision()
    print(f"Current revision: {rev!r}", flush=True)

    if rev is None:
        print("No alembic_version found — stamping baseline at 0003", flush=True)
        run(["alembic", "stamp", "0003"])

    print("Running alembic upgrade head...", flush=True)
    run(["alembic", "upgrade", "head"])
    print("Migrations complete.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
