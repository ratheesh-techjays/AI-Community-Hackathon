"""Scenario compute endpoints.

Currently a synchronous in-memory stub so the frontend can integrate against a
real contract from day one. The async Cloud Run Job path is the next milestone.

TODO(backend): replace the in-memory stores with Postgres + Cloud Tasks enqueue.
TODO(backend): wire the L2->L3->L4->L5 pipeline into a worker entrypoint.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from prahari.api.errors import RunNotFoundError, TruthUnavailableError
from prahari.config.regions import AOI_PRESETS
from prahari.config.settings import get_settings
from prahari.models.disclosure import ModelDisclosure

router = APIRouter(tags=["scenarios"])


class RunStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class TrackSource(BaseModel):
    kind: Literal["ibtracs", "gdacs", "bulletin", "manual"] = "ibtracs"
    storm_name: str | None = None
    season: int | None = None


class HazardParams(BaseModel):
    surge_level_m: float | None = None
    funnel_amplification: float | None = None
    holland_b_override: float | None = Field(None, ge=1.0, le=2.5)
    dem_offset_m: float = 0.0


class ScenarioRequest(BaseModel):
    track: TrackSource
    aoi_preset: str = "puri_khordha"
    hazard: HazardParams = HazardParams()
    generate_advisories: bool = True
    languages: list[Literal["en", "or"]] = ["en"]
    run_validation: bool = False
    label: str | None = None  # cosmetic; excluded from params_hash


class ScenarioAccepted(BaseModel):
    run_id: uuid.UUID
    status: RunStatus
    params_hash: str
    cache_hit: bool
    poll_url: str
    events_url: str
    estimated_seconds: int | None = None


class ScenarioSummary(BaseModel):
    storm_name: str
    peak_surge_m: float
    area_flooded_km2: float
    population_at_risk: int
    buildings_at_risk: int
    shelters_total: int
    shelters_compromised: int  # flagship metric
    unassigned_population: int
    compressed_timeline: bool
    disclosure: ModelDisclosure


class ScenarioDetail(BaseModel):
    run_id: uuid.UUID
    status: RunStatus
    request: ScenarioRequest
    params_hash: str
    code_version: str
    config_version: str
    stages_complete: list[str] = []
    warnings: list[str] = []
    summary: ScenarioSummary | None = None
    created_at: datetime


_RUNS: dict[uuid.UUID, ScenarioDetail] = {}
_BY_HASH: dict[str, uuid.UUID] = {}

# Storms with no usable post-landfall Sentinel-1 imagery. Requesting
# validation for these returns 424 rather than a fabricated skill score.
NO_SAR_TRUTH = {"MICHAUNG", "REMAL", "BIPARJOY"}


def params_hash(req: ScenarioRequest) -> str:
    """Content address used as the cache key. Cosmetic fields are excluded."""
    settings = get_settings()
    payload = {
        "request": req.model_dump(mode="json", exclude={"label"}),
        "code_version": "0.1.0",
        "config_version": settings.config_version,
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


@router.post("/scenarios", response_model=ScenarioAccepted, status_code=202)
async def create_scenario(
    req: ScenarioRequest,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> ScenarioAccepted:
    if req.run_validation and (req.track.storm_name or "").upper() in NO_SAR_TRUTH:
        raise TruthUnavailableError(
            f"{req.track.storm_name} has no usable post-landfall Sentinel-1 "
            "imagery. A validation score cannot be fabricated."
        )
    if req.aoi_preset not in AOI_PRESETS:
        raise RunNotFoundError(f"unknown AOI preset {req.aoi_preset!r}")

    phash = params_hash(req)
    existing_id = _BY_HASH.get(phash)
    if existing_id is not None:
        return ScenarioAccepted(
            run_id=existing_id,
            status=RunStatus.COMPLETE,
            params_hash=phash,
            cache_hit=True,
            poll_url=f"/api/v1/scenarios/{existing_id}",
            events_url=f"/api/v1/scenarios/{existing_id}/events",
        )

    run_id = uuid.uuid4()
    _RUNS[run_id] = ScenarioDetail(
        run_id=run_id,
        status=RunStatus.QUEUED,
        request=req,
        params_hash=phash,
        code_version="0.1.0",
        config_version=get_settings().config_version,
        created_at=datetime.now(UTC),
    )
    _BY_HASH[phash] = run_id

    return ScenarioAccepted(
        run_id=run_id,
        status=RunStatus.QUEUED,
        params_hash=phash,
        cache_hit=False,
        poll_url=f"/api/v1/scenarios/{run_id}",
        events_url=f"/api/v1/scenarios/{run_id}/events",
        estimated_seconds=90,
    )


@router.get("/scenarios/{run_id}", response_model=ScenarioDetail)
async def get_scenario(run_id: uuid.UUID) -> ScenarioDetail:
    run = _RUNS.get(run_id)
    if run is None:
        raise RunNotFoundError(str(run_id))
    return run
