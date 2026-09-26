"""The storm catalogue: every named storm in the IBTrACS NI file.

Nothing is hand-listed here. Each entry is parsed from the CSV, its landfall
is detected the same way the pipeline detects it, and the landfall point is
attributed to a coast segment from config/regions.py. What a run could
honestly claim (validation, shelters) follows from those facts.
"""

from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from prahari.config.regions import LAYER_COVERAGE_BBOX, NO_SAR_TRUTH, coast_of
from prahari.hazard.track import detect_landfall
from prahari.ingestion.tracks.ibtracs import parse_rows
from prahari.models.track import CycloneTrack, TrackPoint

# Sentinel-1A delivered its first operational GRD scenes in October 2014.
SENTINEL1_START = date(2014, 10, 3)
UNNAMED = "UNNAMED"


class StormEntry(BaseModel):
    sid: str
    name: str
    season: int
    first_seen: datetime
    peak_wind_kt: float | None
    landfall_at: datetime | None
    landfall_lat: float | None
    landfall_lon: float | None
    landfall_coast: str | None  # e.g. "Odisha", "Bangladesh"
    landfall_country: str | None
    landfall_wind_kt: float | None
    # Why a scenario cannot be modelled, or None when it can.
    not_modellable: str | None
    # Why the extent cannot be scored against Sentinel-1, or None when it may be.
    no_sar_reason: str | None


MIN_USABLE_POINTS = 4


def usable_points(track: CycloneTrack) -> list[TrackPoint]:
    """Points the wind model can use: JTWC wind and central pressure present."""
    return [p for p in track.points if p.max_wind_kt and p.central_pressure_mb]


def _in_coverage(lat: float, lon: float) -> bool:
    minlon, minlat, maxlon, maxlat = LAYER_COVERAGE_BBOX
    return minlon <= lon <= maxlon and minlat <= lat <= maxlat


# Why a track cannot be modelled, as a stable code the API maps to a problem slug.
NotModellable = Literal[
    "no_landfall", "formed_over_land", "outside_coverage", "no_coast", "track_too_short"
]


def assess(track: CycloneTrack) -> tuple[NotModellable | None, str | None]:
    """(code, plain reason) when the pipeline cannot model this track, else (None, None)."""
    landfall = detect_landfall(track.points)
    coast = coast_of(landfall.lat, landfall.lon) if landfall else None
    first = track.points[0].dist2land_km
    if landfall is None:
        return "no_landfall", "Never made landfall in the best track."
    if first is not None and first <= 0:
        return "formed_over_land", "Formed over land, so there is no coastal landfall to model."
    if not _in_coverage(landfall.lat, landfall.lon):
        return "outside_coverage", "Landfall is outside the area the Earth Engine layers cover."
    if coast is None or coast.island:
        return "no_coast", "Landfall is not on a mainland coast PRAHARI has configured."
    if len(usable_points(track)) < MIN_USABLE_POINTS:
        return (
            "track_too_short",
            "Track lacks the JTWC wind and pressure the wind model needs.",
        )
    return None, None


def entry_from_rows(rows: list[dict[str, str]]) -> StormEntry:
    track = parse_rows(rows)
    landfall = detect_landfall(track.points)
    coast = coast_of(landfall.lat, landfall.lon) if landfall else None
    _, not_modellable = assess(track)

    name = track.name.upper()
    if name in NO_SAR_TRUTH:
        no_sar = "No usable post-landfall Sentinel-1 imagery exists for this storm."
    elif landfall is None:
        no_sar = "No landfall, so there is no flood to score."
    elif landfall.iso_time.date() < SENTINEL1_START:
        no_sar = "Before Sentinel-1 (October 2014): no radar imagery to score against."
    else:
        no_sar = None
    peaks = [p.max_wind_kt for p in track.points if p.max_wind_kt is not None]
    return StormEntry(
        sid=track.sid,
        name=track.name,
        season=track.season,
        first_seen=track.points[0].iso_time.replace(tzinfo=UTC),
        peak_wind_kt=max(peaks) if peaks else None,
        landfall_at=landfall.iso_time.replace(tzinfo=UTC) if landfall else None,
        landfall_lat=landfall.lat if landfall else None,
        landfall_lon=landfall.lon if landfall else None,
        landfall_coast=coast.name if coast else None,
        landfall_country=coast.country if coast else None,
        landfall_wind_kt=landfall.max_wind_kt if landfall else None,
        not_modellable=not_modellable,
        no_sar_reason=no_sar,
    )


def build(csv_text: str) -> list[StormEntry]:
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader)
    next(reader)  # the units row
    by_sid: dict[str, list[dict[str, str]]] = {}
    for raw in reader:
        if len(raw) < len(header):
            continue
        row = dict(zip(header, raw, strict=False))
        if row["NAME"].strip().upper() in {UNNAMED, "NOT_NAMED", ""}:
            continue
        by_sid.setdefault(row["SID"].strip(), []).append(row)
    entries = [entry_from_rows(rows) for rows in by_sid.values() if len(rows) >= 2]
    return sorted(entries, key=lambda e: e.first_seen, reverse=True)


@lru_cache(maxsize=2)
def load(path: Path, mtime: float) -> tuple[StormEntry, ...]:
    """Parsed once per file version (mtime is part of the cache key)."""
    del mtime
    return tuple(build(path.read_text(encoding="utf-8", errors="replace")))


def catalogue(path: Path) -> tuple[StormEntry, ...]:
    return load(path, path.stat().st_mtime)
