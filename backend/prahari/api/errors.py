"""RFC 9457 problem+json error handling.

DELIBERATE ASYMMETRY: an AI failure degrades to a template (200). A hazard
model failure returns 500. We serve a worse sentence, never a wrong number.
The frontend retry interceptor knows not to retry hazard-model-error.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

PROBLEM_BASE = "https://prahari.dev/problems"


class FieldError(BaseModel):
    field: str
    message: str


class Problem(BaseModel):
    type: str
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    errors: list[FieldError] | None = None


class PrahariError(Exception):
    """Base application error mapped to problem+json."""

    slug = "internal-error"
    title = "Internal error"
    status = 500

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.title)
        self.detail = detail


class IngestionError(PrahariError):
    slug, title, status = "ingestion-error", "Upstream data unavailable", 503


class StormNotFoundError(PrahariError):
    slug, title, status = "storm-not-found", "Storm not found", 404


class RunNotFoundError(PrahariError):
    slug, title, status = "run-not-found", "Scenario run not found", 404


class AOITooLargeError(PrahariError):
    slug, title, status = "aoi-too-large", "AOI exceeds compute budget", 413


class TruthUnavailableError(PrahariError):
    """run_validation requested for a storm with no SAR ground truth.

    Returned for e.g. Michaung and Remal, which lack usable post-landfall
    Sentinel-1 imagery. We return 424 rather than fabricating a skill score.
    """

    slug, title, status = "truth-unavailable", "No validation ground truth", 424


class HazardModelError(PrahariError):
    """The science failed. Fail loudly -- never degrade silently."""

    slug, title, status = "hazard-model-error", "Hazard model failure", 500


class QuotaExceededError(PrahariError):
    slug, title, status = "quota-exceeded", "Upstream quota exceeded", 429


def _problem_response(problem: Problem, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=problem.status,
        content=problem.model_dump(exclude_none=True),
        media_type="application/problem+json",
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(PrahariError)
    async def _handle_prahari(request: Request, exc: PrahariError) -> JSONResponse:
        headers = {"Retry-After": "30"} if isinstance(exc, QuotaExceededError) else None
        return _problem_response(
            Problem(
                type=f"{PROBLEM_BASE}/{exc.slug}",
                title=exc.title,
                status=exc.status,
                detail=exc.detail,
                instance=str(request.url.path),
            ),
            headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return _problem_response(
            Problem(
                type=f"{PROBLEM_BASE}/validation-error",
                title="Request validation failed",
                status=422,
                instance=str(request.url.path),
                errors=[
                    FieldError(field=".".join(str(p) for p in e["loc"]), message=e["msg"])
                    for e in exc.errors()
                ],
            )
        )
