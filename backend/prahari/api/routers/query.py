"""POST /query: analyst questions over a stored run (Gemini function calling).

Public by design: it only reads stored runs, so it needs no write key (a key
baked into the browser bundle would not be a secret). It is rate-limited
because every question is a live Gemini call."""

from __future__ import annotations

import threading
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from prahari.ai.client import get_ai_client
from prahari.ai.query import QueryRequest, QueryResponse, answer
from prahari.api.errors import QuotaExceededError, RunNotFoundError
from prahari.api.service import ScenarioService, get_scenario_service

router = APIRouter(tags=["query"])
Service = Annotated[ScenarioService, Depends(get_scenario_service)]

# Each question is up to 5 live Gemini calls; a simple global window keeps a
# demo from draining the quota. Beyond it: 429 + Retry-After (errors.py).
_WINDOW_S = 60.0
_MAX_PER_WINDOW = 12  # all clients together
_MAX_PER_CLIENT = 4  # one client cannot lock everyone else out
_lock = threading.Lock()
_recent: list[float] = []
_by_client: dict[str, list[float]] = {}


def _rate_limit(client: str) -> None:
    now = time.monotonic()
    with _lock:
        _recent[:] = [t for t in _recent if now - t < _WINDOW_S]
        mine = [t for t in _by_client.get(client, []) if now - t < _WINDOW_S]
        if len(mine) >= _MAX_PER_CLIENT or len(_recent) >= _MAX_PER_WINDOW:
            raise QuotaExceededError("Too many questions this minute; try again shortly.")
        mine.append(now)
        _by_client[client] = mine
        if len(_by_client) > 10_000:  # bounded memory under many distinct callers
            for key in [k for k, v in _by_client.items() if not v or now - v[-1] >= _WINDOW_S]:
                del _by_client[key]
        _recent.append(now)


@router.post("/query", response_model=QueryResponse)
def query(req: QueryRequest, svc: Service, request: Request) -> QueryResponse:
    meta = svc.store.resolve(req.run_id)
    result = svc.store.result(meta.run_id) if meta else None
    if result is None:
        raise RunNotFoundError(f"no completed run {req.run_id!r}")
    # Google's front end APPENDS the real caller to X-Forwarded-For; everything to
    # its left is client-supplied and spoofable. Take the rightmost hop.
    forwarded = [
        h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()
    ]
    _rate_limit(forwarded[-1] if forwarded else (request.client.host if request.client else "?"))
    return answer(result, req, get_ai_client())
