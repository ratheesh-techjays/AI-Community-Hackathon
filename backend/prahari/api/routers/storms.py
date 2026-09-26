"""Storm catalogue and track endpoints.

The catalogue is every named storm in the IBTrACS NI file, not a hand list.
Each entry says where it made landfall, whether PRAHARI can model it, and
whether its flood extent could be scored against Sentinel-1, with reasons.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from prahari.api.errors import StormNotFoundError
from prahari.api.service import ScenarioService, get_scenario_service
from prahari.config.paths import IBTRACS_CSV
from prahari.config.regions import EMS_ACTIVATIONS, STORM_NOTES
from prahari.hazard.track import detect_landfall, smooth_rmw
from prahari.ingestion.tracks import catalogue, ibtracs
from prahari.models.track import CycloneTrack

router = APIRouter(tags=["storms"])
Service = Annotated[ScenarioService, Depends(get_scenario_service)]

IBTRACS_PATH = IBTRACS_CSV


class StormSummary(BaseModel):
    sid: str
    name: str
    season: int
    peak_wind_kt: float | None
    landfall_at: datetime | None
    landfall_lat: float | None
    landfall_lon: float | None
    landfall_coast: str | None
    landfall_country: str | None
    landfall_wind_kt: float | None
    modellable: bool
    not_modellable_reason: str | None
    # False when a Sentinel-1 score cannot exist; the reason says why.
    sar_possible: bool
    no_sar_reason: str | None
    has_ems_activation: bool
    note: str | None
    # Alias of a stored run for this storm, when one exists.
    precomputed_run: str | None


class StormsResponse(BaseModel):
    storms: list[StormSummary]
    total: int


def _ibtracs_missing() -> StormNotFoundError:
    return StormNotFoundError(
        f"IBTrACS not downloaded. Run 'make data' (expected at {IBTRACS_PATH})."
    )


@router.get("/storms", response_model=StormsResponse)
async def list_storms(
    svc: Service,
    q: Annotated[str | None, Query(max_length=40)] = None,
    season: int | None = None,
    coast: Annotated[str | None, Query(max_length=40)] = None,
    modellable: bool | None = None,
) -> StormsResponse:
    if not IBTRACS_PATH.exists():
        raise _ibtracs_missing()
    runs: dict[tuple[str, int], str] = {}
    for m in sorted(svc.store.metas(), key=lambda m: m.created_at):
        track = m.request.get("track", {})
        if m.status == "COMPLETE" and track.get("storm_name") and track.get("season"):
            key = (str(track["storm_name"]).upper(), int(track["season"]))
            # An aliased (precomputed) run wins over an ad hoc one.
            if m.alias or key not in runs:
                runs[key] = m.alias or m.run_id
    out = []
    for e in catalogue.catalogue(IBTRACS_PATH):
        if q and q.strip().upper() not in e.name:
            continue
        if season is not None and e.season != season:
            continue
        if coast and (e.landfall_coast or "").lower() != coast.lower():
            continue
        if modellable is not None and (e.not_modellable is None) != modellable:
            continue
        out.append(
            StormSummary(
                sid=e.sid,
                name=e.name,
                season=e.season,
                peak_wind_kt=e.peak_wind_kt,
                landfall_at=e.landfall_at,
                landfall_lat=e.landfall_lat,
                landfall_lon=e.landfall_lon,
                landfall_coast=e.landfall_coast,
                landfall_country=e.landfall_country,
                landfall_wind_kt=e.landfall_wind_kt,
                modellable=e.not_modellable is None,
                not_modellable_reason=e.not_modellable,
                sar_possible=e.no_sar_reason is None,
                no_sar_reason=e.no_sar_reason,
                has_ems_activation=e.name in EMS_ACTIVATIONS,
                note=STORM_NOTES.get((e.name, e.season)),
                precomputed_run=runs.get((e.name, e.season)),
            )
        )
    return StormsResponse(storms=out, total=len(out))


@router.get("/storms/{name}/track", response_model=CycloneTrack)
async def get_track(name: str, season: int | None = None) -> CycloneTrack:
    if not IBTRACS_PATH.exists():
        raise _ibtracs_missing()
    try:
        track = ibtracs.load_storm(IBTRACS_PATH, name, season)
    except ValueError as exc:
        raise StormNotFoundError(str(exc)) from exc

    smoothed = smooth_rmw(track.points)
    return track.model_copy(update={"points": smoothed, "landfall": detect_landfall(smoothed)})
