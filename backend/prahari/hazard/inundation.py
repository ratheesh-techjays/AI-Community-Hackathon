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
    return np.asarray((dem <= surge_level_m) & ~np.isnan(dem), dtype=bool)


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

    return np.asarray(np.isin(labels, seed_ids) & candidate, dtype=bool)


def split_water(
    dem: np.ndarray,
    water_occurrence: np.ndarray,
    min_occurrence: float = 80.0,
    inlet_cells: int = 2,
) -> tuple[np.ndarray, np.ndarray]:
    """Split surface water into (open sea, enclosed lagoons).

    A water cell is DEM <= 0 m or near-permanent surface water. A morphological
    opening of `inlet_cells` removes channels narrower than about
    2 x inlet_cells + 1 cells. That separates tidal lagoons such as Chilika
    from the sea: a narrow inlet throttles surge, so a static bathtub must
    neither seed from a lagoon nor flood across it. Narrow rivers vanish in the
    opening and stay open as conduits, as estuaries are for surge.

    The sea is the largest edge-touching water body that survives the opening.
    Every other surviving body is a lagoon.
    """
    water = (dem <= 0.0) | (water_occurrence >= min_occurrence)
    opened = ndimage.binary_opening(water, structure=_STRUCTURE, iterations=inlet_cells)
    labels, count = ndimage.label(opened, structure=_STRUCTURE)
    empty = np.zeros_like(water, dtype=bool)
    if count == 0:
        return empty, empty
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge = edge[edge > 0]
    if edge.size == 0:
        return empty, opened
    sizes = ndimage.sum(opened, labels, index=edge)
    sea_core = labels == edge[int(np.argmax(sizes))]
    # Give back the coastline cells the opening shaved off the sea itself.
    sea = ndimage.binary_dilation(sea_core, structure=_STRUCTURE, iterations=inlet_cells) & water
    lagoons = opened & ~sea_core
    lagoons = (
        ndimage.binary_dilation(lagoons, structure=_STRUCTURE, iterations=inlet_cells)
        & water
        & ~sea
    )
    return sea, lagoons


def ocean_mask(dem: np.ndarray, water_occurrence: np.ndarray) -> np.ndarray:
    return split_water(dem, water_occurrence)[0]


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
