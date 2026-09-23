"""Health endpoint.

Reports ``degraded`` rather than ``error`` when only Gemini or Earth Engine is
unavailable: precomputed runs and the template fallback still work, which is
what "deployable" means. Probes are real calls, cached, never assumptions.
"""

from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from prahari import __version__
from prahari.ai.client import get_ai_client
from prahari.config.settings import get_settings
from prahari.storage.runs import RUNS_DIR

router = APIRouter(tags=["meta"])
_EE_TTL_S = 300.0
_ee_probe: tuple[float, bool] | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    gee_authenticated: bool
    gemini_reachable: bool
    store_writable: bool
    ai_enabled: bool
    code_version: str


def _gee_ok() -> bool:
    global _ee_probe
    now = time.monotonic()
    if _ee_probe and now - _ee_probe[0] < _EE_TTL_S:
        return _ee_probe[1]
    ok = False
    if get_settings().gee_project:
        try:
            from prahari.gee.client import ensure_initialised, get_info

            ee = ensure_initialised()
            ok = get_info(ee.Number(1)) == 1
        except Exception:
            ok = False
    _ee_probe = (now, ok)
    return ok


def _store_ok() -> bool:
    try:
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        probe = RUNS_DIR / ".write-probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


@router.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    settings = get_settings()
    gemini_ok = get_ai_client().reachable() if settings.gemini_api_key else False
    gee_ok = _gee_ok()
    store_ok = _store_ok()
    return HealthResponse(
        status="ok" if (store_ok and gemini_ok and gee_ok) else "degraded",
        gee_authenticated=gee_ok,
        gemini_reachable=gemini_ok,
        store_writable=store_ok,
        ai_enabled=settings.enable_ai,
        code_version=__version__,
    )
