import asyncio
import logging
import uuid as _uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    poolclass=NullPool,
    connect_args={
        # pgbouncer transaction mode: asyncpg must never reuse prepared-statement
        # names across connections — UUIDs guarantee global uniqueness so stale
        # statements left on a recycled pgbouncer backend never cause conflicts.
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"_ps_{_uuid.uuid4().hex}",
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db(retries: int = 5, delay: float = 2.0) -> None:
    """Create all tables on startup. Retries on transient pgbouncer/connection errors."""
    from sqlalchemy import text
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                # Clear stale prepared statements left by pgbouncer on cold wake
                try:
                    await conn.execute(text("DEALLOCATE ALL"))
                except Exception:
                    pass
                await conn.run_sync(Base.metadata.create_all)
            return
        except Exception as e:
            if attempt == retries:
                raise
            logger.warning("[DB] init_db attempt %d/%d failed: %s — retrying in %.0fs", attempt, retries, e, delay)
            await engine.dispose()
            await asyncio.sleep(delay)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
