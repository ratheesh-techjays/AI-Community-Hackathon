"""Connectivity-constrained bathtub inundation.

Naive ``dem <= level`` thresholding floods hydraulically DISCONNECTED
depressions inland, producing false "lakes". Documented overestimate:
Poulter & Halpin 2008, IJGIS. We therefore flood-fill from the ocean and keep
only the connected component -- see ADR-005 for why this runs in scipy rather
than Earth Engine.
"""

from __future__ import annotations

import numpy as np
from scipy import ndimage

# 8-connectivity: diagonal flow paths are hydraulically real at 30 m.
_STRUCTURE = np.ones((3, 3), dtype=bool)


def naive_threshold(dem: np.ndarray, surge_level_m: float) -> np.ndarray:
    """Elevation threshold WITHOUT connectivity. Reference/comparison only."""
    return (dem <= surge_level_m) & ~np.isnan(dem)


def connected_inundation(
    dem: np.ndarray,
    surge_level_m: float,
    ocean_mask: np.ndarray,
) -> np.ndarray:
    """Flood extent hydrologically connected to the sea.

    Guaranteed to be a subset of :func:`naive_threshold` -- asserted by quality
    gate G5.
    """
    if dem.shape != ocean_mask.shape:
        raise ValueError(f"shape mismatch: dem {dem.shape} vs ocean {ocean_mask.shape}")

    candidate = naive_threshold(dem, surge_level_m)
    labels, _ = ndimage.label(candidate | ocean_mask, structure=_STRUCTURE)

    seed_ids = np.unique(labels[ocean_mask & (labels > 0)])
    if seed_ids.size == 0:
        return np.zeros_like(candidate, dtype=bool)

    return np.isin(labels, seed_ids) & candidate


def flooded_area_km2(mask: np.ndarray, cell_area_km2_value: float) -> float:
    return float(mask.sum() * cell_area_km2_value)


def cell_area_km2(bbox: tuple[float, float, float, float], width: int, height: int) -> float:
    """Approximate cell area, using the bbox mid-latitude for longitude scaling."""
    minlon, minlat, maxlon, maxlat = bbox
    mid_lat = (minlat + maxlat) / 2.0
    km_per_deg_lat = 110.574
    km_per_deg_lon = 111.320 * np.cos(np.radians(mid_lat))
    return float(
        ((maxlon - minlon) / width * km_per_deg_lon) * ((maxlat - minlat) / height * km_per_deg_lat)
    )
