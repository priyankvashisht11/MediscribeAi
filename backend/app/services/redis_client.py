# backend/app/services/redis_client.py
#
# Holds the shared Redis async client as a module-level singleton.
# main.py initialises it during lifespan; all services import from here.
# This avoids the circular import that arises from importing `app.main` inside
# services that are themselves imported by routers that are imported by main.

import redis.asyncio as aioredis

_client: aioredis.Redis | None = None


def set_client(client: aioredis.Redis) -> None:
    global _client
    _client = client


def get_client() -> aioredis.Redis:
    if _client is None:
        raise RuntimeError("Redis client not initialised. Was lifespan() called?")
    return _client
