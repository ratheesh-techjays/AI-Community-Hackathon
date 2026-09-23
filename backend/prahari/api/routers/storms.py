"""Storm catalogue and track endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from prahari.api.errors import StormNotFoundError
from prahari.config.paths import IBTRACS_CSV
from prahari.hazard.track import detect_landfall, smooth_rmw
from prahari.ingestion.tracks import ibtracs
from prahari.models.track import CycloneTrack

router = APIRouter(tags=["storms"])

IBTRACS_PATH = IBTRACS_CSV


class StormSummary(BaseModel):
    name: str
    season: int
    has_sar_truth: bool
    has_ems_activation: bool
    note: str


# Fani is the BUILD storm: the only Indian cyclone with an official Copernicus
# EMS activation (EMSR357), verified by enumerating every India/Bangladesh
# activation. Michaung and Remal lack usable post-landfall Sentinel-1 imagery
# entirely -- Sentinel-1B was lost in Dec 2021, degrading revisit 6 -> 12 days.
CATALOGUE: list[StormSummary] = [
    StormSummary(
        name="FANI",
        season=2019,
        has_sar_truth=True,
        has_ems_activation=True,
        note="Build storm. Only Indian cyclone with a Copernicus EMS activation (EMSR357).",
    ),
    StormSummary(
        name="YAAS",
        season=2021,
        has_sar_truth=True,
        has_ems_activation=False,
        note=(
            "Precomputed demo run. A same-orbit Sentinel-1 pair exists; nothing in its "
            "swath was scorable."
        ),
    ),
    StormSummary(
        name="AMPHAN",
        season=2020,
        has_sar_truth=True,
        has_ems_activation=False,
        note="Backup. Costliest cyclone ever to strike India.",
    ),
    StormSummary(
        name="MICHAUNG",
        season=2023,
        has_sar_truth=False,
        has_ems_activation=False,
        note="DO NOT use for validation: no post-landfall Sentinel-1 granule exists.",
    ),
]


class StormsResponse(BaseModel):
    storms: list[StormSummary]


@router.get("/storms", response_model=StormsResponse)
async def list_storms() -> StormsResponse:
    return StormsResponse(storms=CATALOGUE)


@router.get("/storms/{name}/track", response_model=CycloneTrack)
async def get_track(name: str, season: int | None = None) -> CycloneTrack:
    if not IBTRACS_PATH.exists():
        raise StormNotFoundError(
            f"IBTrACS not downloaded. Run 'make data' (expected at {IBTRACS_PATH})."
        )
    try:
        track = ibtracs.load_storm(IBTRACS_PATH, name, season)
    except ValueError as exc:
        raise StormNotFoundError(str(exc)) from exc

    smoothed = smooth_rmw(track.points)
    return track.model_copy(update={"points": smoothed, "landfall": detect_landfall(smoothed)})
