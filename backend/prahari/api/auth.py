"""API-key guard for write and compute endpoints (06-api-contracts.md §1)."""

from __future__ import annotations

import hmac

from fastapi import Header

from prahari.api.errors import UnauthorizedError
from prahari.config.settings import get_settings


def require_write_key(x_prahari_key: str | None = Header(None, alias="X-Prahari-Key")) -> None:
    settings = get_settings()
    expected = settings.prahari_api_key
    if not expected:
        if settings.env == "local":
            return
        raise UnauthorizedError("Writes are disabled: PRAHARI_API_KEY is not configured.")
    if x_prahari_key is None or not hmac.compare_digest(x_prahari_key, expected):
        raise UnauthorizedError()
