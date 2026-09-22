"""Hazard models. Note the Literal[True] on connectivity_enforced --
a non-connectivity-checked flood mask CANNOT be constructed."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from prahari.models.disclosure import ModelDisclosure


class GridSpec(BaseModel):
    bbox: tuple[float, float, float, float]  # minlon, minlat, maxlon, maxlat
    width: int
    height: int
    crs: str = "EPSG:4326"

    @property
    def resolution_deg(self) -> tuple[float, float]:
        minlon, minlat, maxlon, maxlat = self.bbox
        return ((maxlon - minlon) / self.width, (maxlat - minlat) / self.height)


class SurgeEstimate(BaseModel):
    peak_surge_m: float = Field(ge=0)
    funnel_amplification: float
    coefficient: float
    model_class: Literal["heuristic_index"] = "heuristic_index"
    imd_forecast_surge_m: str | None = None  # IMD's own number, shown alongside
    disclosure: ModelDisclosure


class InundationFootprint(BaseModel):
    grid: GridSpec
    surge_level_m: float
    area_flooded_km2: float
    connectivity_enforced: Literal[True] = True
    dem_asset: str
    dem_vertical_error_m: float = 4.0
    disclosure: ModelDisclosure
