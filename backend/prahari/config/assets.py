"""Earth Engine asset IDs, pinned in one place.

WARNING: COPERNICUS/DEM/GLO30 is DEPRECATED and silently breaks.
The live ID is GLO30_2024_1. See docs/research/R7.
"""

from __future__ import annotations

from typing import Final

DEM_COPERNICUS: Final = "COPERNICUS/DEM/GLO30_2024_1"  # NOT plain GLO30
DEM_SRTM: Final = "USGS/SRTMGL1_003"  # fallback only
POPULATION_WORLDPOP: Final = "WorldPop/GP/100m/pop"
POPULATION_GHSL: Final = "JRC/GHSL/P2023A/GHS_POP"
BUILDINGS_OPEN_BUILDINGS: Final = "GOOGLE/Research/open-buildings/v3/polygons"
BUILDINGS_TEMPORAL: Final = "GOOGLE/Research/open-buildings-temporal/v1"
SENTINEL1_GRD: Final = "COPERNICUS/S1_GRD"
SENTINEL2_SR: Final = "COPERNICUS/S2_SR_HARMONIZED"
SURFACE_WATER: Final = "JRC/GSW1_4/GlobalSurfaceWater"
POWER_PLANTS: Final = "WRI/GPPD/power_plants"

IBTRACS_NI_URL: Final = (
    "https://www.ncei.noaa.gov/data/"
    "international-best-track-archive-for-climate-stewardship-ibtracs/"
    "v04r01/access/csv/ibtracs.NI.list.v04r01.csv"
)
