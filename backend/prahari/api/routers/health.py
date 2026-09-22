"""Health endpoint.

Reports ``degraded`` rather than ``error`` when only Gemini is unavailable --
the product genuinely works on deterministic templates, which is what
"deployable" means. That distinction is the deployability story in one field.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from prahari.config.settings import get_settings

router = APIRouter(tags=["meta"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    gee_authenticated: bool
    gemini_reachable: bool
    gcs_writable: bool
    db_reachable: bool
    ai_enabled: bool
    code_version: str


@router.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    settings = get_settings()

    # TODO(backend): replace stubs with real probes once clients land.
    gee_ok = bool(settings.gee_project)
    gemini_ok = bool(settings.gemini_api_key)
    gcs_ok = True
    db_ok = True

    critical_ok = gcs_ok and db_ok
    return HealthResponse(
        status="ok" if (critical_ok and gemini_ok) else "degraded",
        gee_authenticated=gee_ok,
        gemini_reachable=gemini_ok,
        gcs_writable=gcs_ok,
        db_reachable=db_ok,
        ai_enabled=settings.enable_ai,
        code_version="0.1.0",
    )
