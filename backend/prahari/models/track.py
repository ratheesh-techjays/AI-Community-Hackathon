"""Cyclone track models.

FIELD-SOURCE RULE: use IBTrACS USA_* (JTWC) columns only.
  - NEWDELHI_* (IMD) carries NO RMW at all.
  - WMO_* is only ~13% populated basin-wide.
  - USA_RMW fill for named storms: Fani 97%, Amphan 96%, Yaas 89%.
See docs/research/R7.
"""

from __future__ import annotations

from datetime import datetime
from itertools import pairwise

from pydantic import BaseModel, Field, model_validator

from prahari.models.provenance import Provenance


class TrackPoint(BaseModel):
    iso_time: datetime
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    max_wind_kt: float | None = None  # USA_WIND
    central_pressure_mb: float | None = None  # USA_PRES
    env_pressure_mb: float | None = None  # USA_POCI
    rmw_nmi: float | None = None  # USA_RMW
    rmw_imputed: bool = False  # set when smoothed or filled
    storm_speed_kt: float | None = None
    storm_dir_deg: float | None = None
    dist2land_km: float | None = None


class LandfallEvent(BaseModel):
    iso_time: datetime
    lat: float
    lon: float
    max_wind_kt: float | None = None


class CycloneTrack(BaseModel):
    sid: str
    name: str
    season: int
    basin: str = "NI"
    points: list[TrackPoint] = Field(min_length=2)
    landfall: LandfallEvent | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def _monotonic_time(self) -> CycloneTrack:
        if any(a.iso_time >= b.iso_time for a, b in pairwise(self.points)):
            raise ValueError("track points must be strictly time-ordered")
        return self

    def hours_to_landfall(self, at: datetime) -> float | None:
        if self.landfall is None:
            return None
        return (self.landfall.iso_time - at).total_seconds() / 3600.0
