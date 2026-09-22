"""AOI grid construction."""

from __future__ import annotations

import numpy as np

from prahari.models.hazard import GridSpec


def make_grid(bbox: tuple[float, float, float, float], resolution_deg: float = 0.0025) -> GridSpec:
    """Build a grid spec. resolution_deg=0.0025 is ~250 m at Indian latitudes."""
    minlon, minlat, maxlon, maxlat = bbox
    return GridSpec(
        bbox=bbox,
        width=max(round((maxlon - minlon) / resolution_deg), 1),
        height=max(round((maxlat - minlat) / resolution_deg), 1),
    )


def grid_coords(grid: GridSpec) -> tuple[np.ndarray, np.ndarray]:
    """Return (lats, lons) meshgrids.

    Row 0 is the NORTH edge, following raster convention.
    """
    minlon, minlat, maxlon, maxlat = grid.bbox
    lons = np.linspace(minlon, maxlon, grid.width)
    lats = np.linspace(maxlat, minlat, grid.height)
    return np.meshgrid(lats, lons, indexing="ij")
