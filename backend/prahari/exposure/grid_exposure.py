"""L3 exposure: hazard x population x buildings x shelters, on the hazard grid.

Pure numpy/scipy. Building counts come in from the LayerSource as a list
aligned with `cluster_zones`, so this module never touches the network.

Places are named only from the OSDMA register (nearest shelter's block and
name). Nothing here invents a settlement name.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

from prahari.ingestion.shelters import ShelterRecord
from prahari.models.hazard import GridSpec
from prahari.models.results import BlockExposure, PopulationCluster, ShelterStatus

Rect = tuple[float, float, float, float]

CLUSTER_FACTOR = 8  # 8 x 0.0025 deg = 0.02 deg, about 2.2 km at Puri
_NEIGHBOURS = np.ones((3, 3), dtype=bool)


def cell_centres(grid: GridSpec) -> tuple[np.ndarray, np.ndarray]:
    """(lats, lons) of cell centres, shape (height, width), row 0 = north."""
    minlon, _, _, maxlat = grid.bbox
    res_x, res_y = grid.resolution_deg
    lons = minlon + (np.arange(grid.width) + 0.5) * res_x
    lats = maxlat - (np.arange(grid.height) + 0.5) * res_y
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    return lat_grid, lon_grid


def cell_of(grid: GridSpec, lat: float, lon: float) -> tuple[int, int] | None:
    minlon, minlat, maxlon, maxlat = grid.bbox
    if not (minlon <= lon < maxlon and minlat < lat <= maxlat):
        return None
    res_x, res_y = grid.resolution_deg
    return int((maxlat - lat) / res_y), int((lon - minlon) / res_x)


class ShelterIndex:
    """Nearest-shelter lookup in an equirectangular projection (km)."""

    def __init__(self, shelters: list[ShelterRecord], mid_lat: float) -> None:
        self.shelters = shelters
        self._kx = 111.32 * np.cos(np.radians(mid_lat))
        self._ky = 110.57
        points = np.array([[s.lon * self._kx, s.lat * self._ky] for s in shelters])
        self._tree = cKDTree(points)

    def nearest(self, lats: np.ndarray, lons: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Index of the nearest shelter and the straight-line distance in km."""
        query = np.column_stack([lons.ravel() * self._kx, lats.ravel() * self._ky])
        dist, idx = self._tree.query(query)
        return idx.reshape(lats.shape), dist.reshape(lats.shape)

    def within(self, lat: float, lon: float, radius_km: float) -> list[tuple[int, float]]:
        hits = self._tree.query_ball_point([lon * self._kx, lat * self._ky], radius_km)
        out = []
        for i in hits:
            s = self.shelters[i]
            d = float(np.hypot((s.lon - lon) * self._kx, (s.lat - lat) * self._ky))
            out.append((i, d))
        return sorted(out, key=lambda t: t[1])


@dataclass(frozen=True)
class ClusterDraft:
    cluster_id: str
    row: int
    col: int
    people: float
    flooded_cells: int
    max_depth_m: float
    lat: float
    lon: float
    zone: list[Rect]


def _row_runs(mask: np.ndarray) -> list[tuple[int, int, int]]:
    runs = []
    for r in range(mask.shape[0]):
        row = mask[r]
        c = 0
        while c < row.size:
            if row[c]:
                start = c
                while c < row.size and row[c]:
                    c += 1
                runs.append((r, start, c))
            else:
                c += 1
    return runs


def draft_clusters(
    grid: GridSpec,
    flooded: np.ndarray,
    depth: np.ndarray,
    population: np.ndarray,
    factor: int = CLUSTER_FACTOR,
) -> list[ClusterDraft]:
    """Aggregate flooded, populated cells into coarse evacuation clusters."""
    lats, lons = cell_centres(grid)
    minlon, _, _, maxlat = grid.bbox
    res_x, res_y = grid.resolution_deg
    out: list[ClusterDraft] = []
    for r0 in range(0, grid.height, factor):
        for c0 in range(0, grid.width, factor):
            block = flooded[r0 : r0 + factor, c0 : c0 + factor]
            if not block.any():
                continue
            pop = np.where(block, population[r0 : r0 + factor, c0 : c0 + factor], 0.0)
            people = float(pop.sum())
            if people < 1.0:
                continue
            w = pop / people
            zone = [
                (
                    minlon + (c0 + cs) * res_x,
                    maxlat - (r0 + r + 1) * res_y,
                    minlon + (c0 + ce) * res_x,
                    maxlat - (r0 + r) * res_y,
                )
                for r, cs, ce in _row_runs(block)
            ]
            out.append(
                ClusterDraft(
                    cluster_id=f"C{r0 // factor:03d}-{c0 // factor:03d}",
                    row=r0,
                    col=c0,
                    people=people,
                    flooded_cells=int(block.sum()),
                    max_depth_m=float(
                        np.max(np.where(block, depth[r0 : r0 + factor, c0 : c0 + factor], 0.0))
                    ),
                    lat=float((w * lats[r0 : r0 + factor, c0 : c0 + factor]).sum()),
                    lon=float((w * lons[r0 : r0 + factor, c0 : c0 + factor]).sum()),
                    zone=zone,
                )
            )
    return out


def finalise_clusters(
    drafts: list[ClusterDraft],
    building_counts: list[int],
    index: ShelterIndex | None,
    cell_km2: float,
    reach_km: float | None = None,
) -> list[PopulationCluster]:
    """A cluster takes the block and name of its nearest register shelter. With
    no register, or a nearest shelter beyond `reach_km`, it keeps no place name:
    a shelter 40 km away would name the wrong village."""
    if len(drafts) != len(building_counts):
        raise ValueError("building_counts must align with drafts")
    clusters = []
    for d, buildings in zip(drafts, building_counts, strict=True):
        shelter: ShelterRecord | None = None
        if index is not None:
            nearest, km = index.nearest(np.array([d.lat]), np.array([d.lon]))
            if reach_km is None or float(km[0]) <= reach_km:
                shelter = index.shelters[int(nearest[0])]
        clusters.append(
            PopulationCluster(
                cluster_id=d.cluster_id,
                block=shelter.block if shelter else None,
                near=shelter.name if shelter else None,
                lat=round(d.lat, 5),
                lon=round(d.lon, 5),
                people_at_risk=round(d.people),
                buildings_at_risk=buildings,
                area_flooded_km2=round(d.flooded_cells * cell_km2, 2),
                max_depth_m=round(d.max_depth_m, 2),
            )
        )
    return clusters


def shelter_states(
    grid: GridSpec,
    shelters: list[ShelterRecord],
    flooded: np.ndarray,
    depth: np.ndarray,
    wind_ms: np.ndarray,
) -> list[ShelterStatus]:
    """Classify every in-grid shelter. Compromised = its own cell floods;
    watch = flood reaches an adjacent cell (within about 275 m)."""
    near_flood = ndimage.binary_dilation(flooded, structure=_NEIGHBOURS)
    out = []
    for s in shelters:
        cell = cell_of(grid, s.lat, s.lon)
        if cell is None:
            continue
        r, c = cell
        if flooded[r, c]:
            state, depth_m = "compromised", round(float(depth[r, c]), 2)
        elif near_flood[r, c]:
            state, depth_m = "watch", None
        else:
            state, depth_m = "safe", None
        out.append(
            ShelterStatus(
                register_id=s.register_id,
                name=s.name,
                district=s.district,
                block=s.block,
                locality=s.locality,
                shelter_type=s.shelter_type,
                lat=s.lat,
                lon=s.lon,
                capacity=s.capacity,
                capacity_imputed=s.capacity_imputed,
                depth_m=depth_m,
                max_wind_ms=round(float(wind_ms[r, c]), 1),
                status=state,
                assigned_people=0,
            )
        )
    return out


def block_rollup(
    clusters: list[PopulationCluster],
    shelters: list[ShelterStatus],
    unzoned: str = "UNKNOWN",
) -> tuple[list[BlockExposure], BlockExposure]:
    """Per-block totals. Clusters with no register block roll up under `unzoned`."""
    acc: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    district_of: dict[str, str] = {}
    for s in shelters:
        key = s.block or unzoned
        district_of.setdefault(key, s.district)
        acc[key]["shelters_total"] += 1
        acc[key]["shelters_compromised"] += s.status == "compromised"
    for c in clusters:
        key = c.block or unzoned
        a = acc[key]
        a["population_at_risk"] += c.people_at_risk
        a["buildings_at_risk"] += c.buildings_at_risk
        a["area_flooded_km2"] += c.area_flooded_km2
        a["max_depth_m"] = max(a["max_depth_m"], c.max_depth_m)

    def row(name: str, a: dict[str, float], district: str | None) -> BlockExposure:
        return BlockExposure(
            block=name,
            district=district,
            population_at_risk=int(a["population_at_risk"]),
            buildings_at_risk=int(a["buildings_at_risk"]),
            area_flooded_km2=round(a["area_flooded_km2"], 2),
            max_depth_m=round(a["max_depth_m"], 2),
            shelters_total=int(a["shelters_total"]),
            shelters_compromised=int(a["shelters_compromised"]),
        )

    rows = sorted(
        (row(k, v, district_of.get(k)) for k, v in acc.items()),
        key=lambda b: b.population_at_risk,
        reverse=True,
    )
    total: dict[str, float] = defaultdict(float)
    for b in rows:
        total["population_at_risk"] += b.population_at_risk
        total["buildings_at_risk"] += b.buildings_at_risk
        total["area_flooded_km2"] += b.area_flooded_km2
        total["max_depth_m"] = max(total["max_depth_m"], b.max_depth_m)
        total["shelters_total"] += b.shelters_total
        total["shelters_compromised"] += b.shelters_compromised
    return rows, row("ALL", total, None)
