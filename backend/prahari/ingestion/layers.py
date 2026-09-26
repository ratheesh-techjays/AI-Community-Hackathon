"""Exposure and truth layers: the only place pipeline data enters from outside.

`LayerSource` is the seam. `EarthEngineLayers` reads the pinned assets in
config/assets.py; tests use a synthetic implementation, so the whole pipeline
runs offline in CI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import numpy as np

from prahari.api.errors import IngestionError
from prahari.config import assets
from prahari.gee.client import ensure_initialised, fetch_grid, get_info
from prahari.models.hazard import GridSpec

Rect = tuple[float, float, float, float]  # minlon, minlat, maxlon, maxlat

# Sentinel-1 change detection. Open water is dark in VV; a drop of 3 dB below
# the pre-event baseline into the water range is the standard flood signal.
SAR_WATER_DB = -16.0
SAR_CHANGE_DB = -3.0
PERMANENT_WATER_OCCURRENCE = 50.0  # JRC GSW %, masked from truth and scoring
BUILDING_MIN_CONFIDENCE = 0.7
SAR_OVERSAMPLE = 4  # classify SAR at ~70 m, then average to the hazard grid
SAR_SPECKLE_RADIUS_M = 60


def _block_mean(a: np.ndarray, k: int) -> np.ndarray:
    h, w = a.shape[0] // k, a.shape[1] // k
    return np.asarray(a[: h * k, : w * k].reshape(h, k, w, k).mean(axis=(1, 3)), dtype=float)


@dataclass(frozen=True)
class SarWindow:
    orbit_pass: str  # "ASCENDING" | "DESCENDING", never mixed pre vs post
    pre_start: str
    pre_end: str
    post_start: str
    post_end: str
    # Pinned when the window was found by search; otherwise the first post orbit.
    relative_orbit: int | None = None


# Window searched for a storm with no pinned pair: the first post-landfall pass
# within POST_DAYS, and a pre-event pass on the SAME relative orbit (so the same
# pass direction and look angle) within PRE_DAYS before landfall.
SAR_SEARCH_POST_DAYS = 4
SAR_SEARCH_PRE_DAYS = 24


@dataclass(frozen=True)
class SarTruth:
    flooded_fraction: np.ndarray  # 0..1 per cell
    valid: np.ndarray  # both passes cover the cell
    pre_dates: list[str]
    post_dates: list[str]
    orbit_pass: str
    truth_source: str


class LayerSource(Protocol):
    def dem(self, grid: GridSpec) -> np.ndarray: ...

    def water_occurrence(self, grid: GridSpec) -> np.ndarray: ...

    def population(self, grid: GridSpec) -> np.ndarray: ...

    def building_counts(self, zones: list[list[Rect]]) -> list[int]: ...

    def sar_truth(self, grid: GridSpec, window: SarWindow) -> SarTruth: ...

    def find_sar_window(
        self, grid: GridSpec, landfall: datetime
    ) -> tuple[SarWindow | None, str]: ...


class EarthEngineLayers:
    """Live layers from Earth Engine on project GEE_PROJECT."""

    def __init__(self, population_year: int = 2019) -> None:
        self.population_year = population_year

    def _region(self, grid: GridSpec) -> Any:
        ee = ensure_initialised()
        return ee.Geometry.Rectangle(list(grid.bbox))

    def dem(self, grid: GridSpec) -> np.ndarray:
        ee = ensure_initialised()
        image = (
            ee.ImageCollection(assets.DEM_COPERNICUS)
            .filterBounds(self._region(grid))
            .select("DEM")
            .mosaic()
        )
        return fetch_grid(image.unmask(0), grid)

    def water_occurrence(self, grid: GridSpec) -> np.ndarray:
        ee = ensure_initialised()
        return fetch_grid(ee.Image(assets.SURFACE_WATER).select("occurrence").unmask(0), grid)

    def population(self, grid: GridSpec) -> np.ndarray:
        ee = ensure_initialised()
        # Every country's tile that touches the grid: a Bangladesh or Myanmar
        # landfall must not read as zero people.
        col = (
            ee.ImageCollection(assets.POPULATION_WORLDPOP)
            .filterBounds(self._region(grid))
            .filter(ee.Filter.eq("year", self.population_year))
        )
        proj = col.first().projection()
        # Mean density x cell area conserves the total. A weighted sum over
        # reduceResolution does not (it under-counted 10x in testing).
        density = col.mosaic().divide(ee.Image.pixelArea()).setDefaultProjection(proj)
        mean_density = density.reduceResolution(ee.Reducer.mean(), maxPixels=1024)
        people = mean_density.multiply(ee.Image.pixelArea())
        return fetch_grid(people.unmask(0), grid)

    def building_counts(self, zones: list[list[Rect]]) -> list[int]:
        """Open Buildings v3 footprints inside each zone (a union of rectangles)."""
        if not zones:
            return []
        ee = ensure_initialised()
        buildings = ee.FeatureCollection(assets.BUILDINGS_OPEN_BUILDINGS).filter(
            ee.Filter.gte("confidence", BUILDING_MIN_CONFIDENCE)
        )
        features = [
            ee.Feature(
                ee.Geometry.MultiPolygon(
                    [ee.Geometry.Rectangle(list(r)).coordinates() for r in rects]
                ),
                {"i": i},
            )
            for i, rects in enumerate(zones)
        ]
        counts: list[int] = []
        batch = 150
        for start in range(0, len(features), batch):
            chunk = ee.FeatureCollection(features[start : start + batch])
            counted = chunk.map(lambda f: f.set("n", buildings.filterBounds(f.geometry()).size()))
            counts.extend(int(n) for n in get_info(counted.aggregate_array("n")))
        return counts

    def sar_truth(self, grid: GridSpec, window: SarWindow) -> SarTruth:
        ee = ensure_initialised()
        region = self._region(grid)
        base = (
            ee.ImageCollection(assets.SENTINEL1_GRD)
            .filterBounds(region)
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.eq("orbitProperties_pass", window.orbit_pass))
            .select("VV")
        )
        post_all = base.filterDate(window.post_start, window.post_end)
        # Same relative orbit pre and post: same look angle, so a backscatter
        # drop is water, not geometry. Mixing orbits even within one pass
        # direction paints swath edges as "flood".
        if window.relative_orbit is not None:
            orbit = window.relative_orbit
        else:
            orbits = get_info(post_all.aggregate_array("relativeOrbitNumber_start").distinct())
            if not orbits:
                raise IngestionError("no post-event Sentinel-1 scene in the configured window")
            orbit = int(orbits[0])
        same_orbit = ee.Filter.eq("relativeOrbitNumber_start", orbit)
        pre_col = base.filterDate(window.pre_start, window.pre_end).filter(same_orbit)
        post_col = post_all.filter(same_orbit)
        if int(get_info(pre_col.size())) == 0:
            raise IngestionError(f"no pre-event scene on relative orbit {orbit}")

        def dates(col: Any) -> list[str]:
            stamps = col.aggregate_array("system:time_start").map(
                lambda t: ee.Date(t).format("YYYY-MM-dd")
            )
            return sorted(set(get_info(stamps)))

        pre_dates, post_dates = dates(pre_col), dates(post_col)
        # Classified on a 4x finer grid and block-averaged here: reprojecting
        # 10 m GRD over the whole AOI in one reduceResolution exceeds EE limits.
        fine = GridSpec(
            bbox=grid.bbox, width=grid.width * SAR_OVERSAMPLE, height=grid.height * SAR_OVERSAMPLE
        )
        pre = pre_col.median().focalMedian(SAR_SPECKLE_RADIUS_M, "circle", "meters")
        post = post_col.mosaic().focalMedian(SAR_SPECKLE_RADIUS_M, "circle", "meters")
        permanent = (
            ee.Image(assets.SURFACE_WATER)
            .select("occurrence")
            .unmask(0)
            .gte(PERMANENT_WATER_OCCURRENCE)
        )
        flooded = (
            post.lt(SAR_WATER_DB)
            .And(post.subtract(pre).lt(SAR_CHANGE_DB))
            .And(pre.gte(SAR_WATER_DB))
            .And(permanent.Not())
        )
        valid = pre.mask().And(post.mask())
        flooded_fine = fetch_grid(flooded.unmask(0), fine)
        valid_fine = fetch_grid(valid.unmask(0), fine)
        fraction = _block_mean(flooded_fine * valid_fine, SAR_OVERSAMPLE)
        coverage = _block_mean(valid_fine, SAR_OVERSAMPLE)
        return SarTruth(
            flooded_fraction=np.nan_to_num(fraction / np.maximum(coverage, 1e-9)),
            valid=coverage >= 0.9,
            pre_dates=pre_dates,
            post_dates=post_dates,
            orbit_pass=window.orbit_pass,
            truth_source=f"sentinel1_vv_change_-3db_relorbit_{orbit}",
        )

    def find_sar_window(self, grid: GridSpec, landfall: datetime) -> tuple[SarWindow | None, str]:
        """The first same-orbit pre/post Sentinel-1 pair around landfall, or why none exists."""
        ee = ensure_initialised()
        base = (
            ee.ImageCollection(assets.SENTINEL1_GRD)
            .filterBounds(self._region(grid))
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        )
        day = landfall.date()
        post_end = day + timedelta(days=SAR_SEARCH_POST_DAYS)
        pre_start = day - timedelta(days=SAR_SEARCH_PRE_DAYS)
        columns = ["system:time_start", "orbitProperties_pass", "relativeOrbitNumber_start"]
        post = get_info(
            base.filterDate(landfall.isoformat(), post_end.isoformat())
            .reduceColumns(ee.Reducer.toList(3), columns)
            .get("list")
        )
        if not post:
            return None, (
                f"No Sentinel-1 pass over this area in the {SAR_SEARCH_POST_DAYS} days after "
                "landfall, so there is no observed flood to score against."
            )
        pre = get_info(
            base.filterDate(pre_start.isoformat(), day.isoformat())
            .reduceColumns(ee.Reducer.toList(3), columns)
            .get("list")
        )
        pre_orbits = {(p, int(o)) for _, p, o in pre}
        for stamp, orbit_pass, orbit in sorted(post, key=lambda r: r[0]):
            if (orbit_pass, int(orbit)) not in pre_orbits:
                continue
            taken = datetime.fromtimestamp(stamp / 1000, UTC).date()
            return (
                SarWindow(
                    orbit_pass=str(orbit_pass),
                    pre_start=pre_start.isoformat(),
                    pre_end=day.isoformat(),
                    post_start=taken.isoformat(),
                    post_end=(taken + timedelta(days=1)).isoformat(),
                    relative_orbit=int(orbit),
                ),
                f"Found by search: relative orbit {int(orbit)}, {str(orbit_pass).lower()} "
                "pass before and after landfall.",
            )
        return None, (
            "Sentinel-1 passed after landfall, but no pre-event pass shares its orbit within "
            f"{SAR_SEARCH_PRE_DAYS} days; pairing different orbits would paint look-angle "
            "differences as flood."
        )
