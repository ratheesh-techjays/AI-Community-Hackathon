"""Synthetic layers and track for offline pipeline tests.

The DEM is a coastal ramp: open sea in the south-east corner, land rising
inland, a closed inland depression (must never flood), and a lagoon joined to
the sea by a one-cell inlet (must act as a barrier). The SAR truth is the
flood a 2 m surge would produce, thinned, so skill is high but not perfect.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np

from prahari.hazard.inundation import connected_inundation, split_water
from prahari.ingestion.layers import Rect, SarTruth, SarWindow
from prahari.models.hazard import GridSpec
from prahari.models.provenance import Provenance
from prahari.models.track import CycloneTrack, LandfallEvent, TrackPoint


def coastal_dem(grid: GridSpec) -> np.ndarray:
    h, w = grid.height, grid.width
    rows, cols = np.mgrid[0:h, 0:w]
    # Distance from the SE coastline, in cells: negative offshore.
    coast = (rows / h + cols / w) - 1.2
    dem = coast * -40.0
    dem = np.clip(dem, -10.0, 60.0)
    # Closed inland depression below sea level, far from the coast.
    dem[h // 8 : h // 8 + 6, w // 8 : w // 8 + 6] = -1.0
    # Lagoon at the south-west edge of the coast, one-cell inlet to the sea.
    r0, c0 = int(h * 0.80), int(w * 0.30)
    dem[r0 : r0 + 12, c0 : c0 + 12] = -0.5
    dem[r0 + 5, c0 + 12 :] = np.minimum(dem[r0 + 5, c0 + 12 :], -0.5)
    return dem


class SyntheticLayers:
    def dem(self, grid: GridSpec) -> np.ndarray:
        return coastal_dem(grid)

    def water_occurrence(self, grid: GridSpec) -> np.ndarray:
        return np.where(coastal_dem(grid) <= 0.0, 100.0, 0.0)

    def population(self, grid: GridSpec) -> np.ndarray:
        return np.full((grid.height, grid.width), 50.0)

    def building_counts(self, zones: list[list[Rect]]) -> list[int]:
        return [3 * len(z) for z in zones]

    def sar_truth(self, grid: GridSpec, window: SarWindow) -> SarTruth:
        dem = coastal_dem(grid)
        sea, lagoons = split_water(dem, self.water_occurrence(grid))
        flooded = connected_inundation(np.where(lagoons, np.inf, dem), 2.0, sea) & ~sea & ~lagoons
        thinned = flooded & (np.indices(flooded.shape).sum(axis=0) % 5 != 0)
        return SarTruth(
            flooded_fraction=thinned.astype(float),
            valid=np.ones(flooded.shape, dtype=bool),
            pre_dates=["2019-04-28"],
            post_dates=["2019-05-04"],
            orbit_pass=window.orbit_pass,
            truth_source="synthetic",
        )

    def find_sar_window(self, grid: GridSpec, landfall: datetime) -> tuple[SarWindow | None, str]:
        return None, "Synthetic layers have no Sentinel-1 archive to search."


def synthetic_track(name: str = "FANI", season: int = 2019) -> CycloneTrack:
    """A storm moving north-north-east to landfall at Puri."""
    start = datetime(2019, 5, 1, 0, 0)
    points = []
    for i in range(12):
        lat = 17.0 + i * 0.4
        points.append(
            TrackPoint(
                iso_time=start + timedelta(hours=6 * i),
                lat=lat,
                lon=85.2 + i * 0.08,
                max_wind_kt=120.0 - 2 * i,
                central_pressure_mb=935.0 + i,
                env_pressure_mb=1004.0,
                rmw_nmi=15.0,
                dist2land_km=max(0.0, (19.8 - lat) * 110),
            )
        )
    landfall = next(p for p in points if p.dist2land_km == 0)
    return CycloneTrack(
        sid="SYNTH",
        name=name,
        season=season,
        points=points,
        landfall=LandfallEvent(
            iso_time=landfall.iso_time,
            lat=landfall.lat,
            lon=landfall.lon,
            max_wind_kt=landfall.max_wind_kt,
        ),
        provenance=Provenance(
            source_id="synthetic", authority="tests", retrieved_at=datetime.now(UTC)
        ),
    )


def track_loader(name: str, season: int | None) -> CycloneTrack:
    return synthetic_track(name.upper(), season or 2019)
