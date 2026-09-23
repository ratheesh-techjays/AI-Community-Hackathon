"""FastAPI application entrypoint.

NOTE: no CORS middleware by design. Firebase Hosting rewrites /api/** to this
service, so the browser sees a single origin. See docs/design/06-api-contracts.md.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware

from prahari import __version__
from prahari.api.errors import register_exception_handlers
from prahari.api.routers import health, meta, query, scenarios, shelters, storms
from prahari.config.settings import get_settings

settings = get_settings()

app = FastAPI(
    title="PRAHARI API",
    version=__version__,
    description="Cyclone impact & infrastructure vulnerability forecaster",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
register_exception_handlers(app)


@app.middleware("http")
async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Propagate a request ID and record server timing."""
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    request.state.request_id = request_id

    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000

    response.headers["X-Request-Id"] = request_id
    response.headers["Server-Timing"] = f"app;dur={elapsed_ms:.1f}"
    return response


for router in (
    health.router,
    meta.router,
    storms.router,
    scenarios.router,
    shelters.router,
    query.router,
):
    app.include_router(router, prefix="/api/v1")
