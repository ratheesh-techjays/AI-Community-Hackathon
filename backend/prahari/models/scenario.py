"""Scenario request and run-status models (POST /scenarios, GET /scenarios/{id})."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from prahari.config.regions import AOI_PRESETS, AUTO_AOI
from prahari.models.results import RunSummary

Language = Literal["en", "or"]


def _english() -> list[Language]:
    return ["en"]


class RunStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class TrackSource(BaseModel):
    kind: Literal["ibtracs", "gdacs", "bulletin", "manual"] = "ibtracs"
    storm_name: str | None = Field(None, max_length=40, pattern=r"^[A-Za-z][A-Za-z -]*$")
    season: int | None = Field(None, ge=1980, le=2100)


class HazardParams(BaseModel):
    surge_level_m: float | None = Field(None, ge=0.0, le=15.0)
    funnel_amplification: float | None = Field(None, ge=0.3, le=3.0)
    holland_b_override: float | None = Field(None, ge=1.0, le=2.5)
    dem_offset_m: float = Field(0.0, ge=-10.0, le=10.0)


class ScenarioRequest(BaseModel):
    track: TrackSource
    # A named preset, or "auto": an area derived from the track's landfall.
    aoi_preset: str = "puri_khordha"
    hazard: HazardParams = HazardParams()
    generate_advisories: bool = True
    languages: list[Language] = Field(default_factory=_english, max_length=2)
    run_validation: bool = False
    label: str | None = Field(None, max_length=120)  # cosmetic; excluded from params_hash

    @field_validator("aoi_preset")
    @classmethod
    def _known_aoi(cls, value: str) -> str:
        if value != AUTO_AOI and value not in AOI_PRESETS:
            choices = [AUTO_AOI, *sorted(AOI_PRESETS)]
            raise ValueError(f"unknown AOI preset; choose one of {choices}")
        return value


class ScenarioAccepted(BaseModel):
    run_id: str
    status: RunStatus
    params_hash: str
    cache_hit: bool
    poll_url: str
    estimated_seconds: int | None = None


class ScenarioDetail(BaseModel):
    run_id: str
    alias: str | None
    status: RunStatus
    request: ScenarioRequest
    params_hash: str
    code_version: str
    config_version: str
    stages_complete: list[str]
    stage_timings_ms: dict[str, int] = {}
    warnings: list[str]
    error: str | None = None
    provenance: dict[str, str] = {}
    summary: RunSummary | None = None
    created_at: datetime
    completed_at: datetime | None = None


class ScenarioListItem(BaseModel):
    run_id: str
    alias: str | None
    status: RunStatus
    label: str | None
    storm_name: str | None
    season: int | None
    aoi_preset: str
    created_at: datetime


class ScenarioList(BaseModel):
    runs: list[ScenarioListItem]
