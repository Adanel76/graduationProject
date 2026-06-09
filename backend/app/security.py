import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings

_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def hash_secret(value: str) -> str:
    key = settings.secret_key or "development-only-secret"
    return hmac.new(key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def constant_time_equals(raw_value: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(raw_value), stored_hash)


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def utcnow() -> datetime:
    return datetime.utcnow()


def expires_in(**kwargs) -> datetime:
    return utcnow() + timedelta(**kwargs)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        host = forwarded.split(",")[0].strip()
    elif request.client:
        host = request.client.host
    else:
        host = "unknown"
    return host


def rate_limit(bucket: str, limit: int, window_seconds: int) -> Callable:
    async def dependency(request: Request):
        if not settings.rate_limit_enabled:
            return

        now = time.monotonic()
        key = f"{bucket}:{_client_key(request)}"
        queue = _RATE_LIMIT_BUCKETS[key]
        while queue and now - queue[0] > window_seconds:
            queue.popleft()
        if len(queue) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Повторите попытку позже.",
            )
        queue.append(now)

    return dependency


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
