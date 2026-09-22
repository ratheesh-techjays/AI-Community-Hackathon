"""Hazard engine tests.

The engine is pure and I/O-free by design, so these run with no network, no
Earth Engine auth, and no API keys. If these pass, the scientific core works.
"""

from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from prahari.hazard.grid import grid_coords, make_grid
from prahari.hazard.holland import (
    B_MAX,
    B_MIN,
    KT_TO_MS,
    coriolis,
    haversine_m,
    holland_b,
    wind_field,
)
from prahari.hazard.inundation import (
    cell_area_km2,
    connected_inundation,
    naive_threshold,
)
from prahari.hazard.surge import DEFAULT_SURGE_MODEL, FUNNEL_AMPLIFICATION
from prahari.hazard.track import RMW_MIN_NMI, rmw_from_intensity, smooth_rmw
from prahari.models.track import TrackPoint

# --------------------------------------------------------------------------
# Holland wind field
# --------------------------------------------------------------------------


def test_holland_b_within_physical_bounds() -> None:
    for vmax_ms in (10.0, 30.0, 50.0, 80.0):
        for dp_pa in (1_000.0, 5_000.0, 10_600.0):
            assert B_MIN <= holland_b(vmax_ms, dp_pa) <= B_MAX


def test_holland_b_fani_is_physically_sane() -> None:
    """Fani at 2019-05-02 12Z: Pc=900mb, Penv=1006mb, Vmax=150kt."""
    vmax_ms = 150 * KT_TO_MS
    dp_pa = (1006 - 900) * 100
    b = holland_b(vmax_ms, dp_pa)
    assert 1.5 < b < 2.0, f"expected ~1.76, got {b}"


def test_holland_b_degrades_gracefully_on_zero_deficit() -> None:
    assert holland_b(40.0, 0.0) == 1.5
    assert holland_b(0.0, 5000.0) == 1.5


def test_wind_peaks_near_radius_of_maximum_wind() -> None:
    """Wind at RMW must exceed wind far outside it."""
    centre_lat, centre_lon, rmw_nmi = 19.8, 85.8, 20.0
    deg_per_nmi = 1.0 / 60.0

    at_rmw = wind_field(
        np.array([centre_lat]),
        np.array([centre_lon + rmw_nmi * deg_per_nmi]),
        centre_lat,
        centre_lon,
        vmax_kt=120,
        rmw_nmi=rmw_nmi,
        central_pressure_mb=940,
        env_pressure_mb=1006,
    )[0]
    far_out = wind_field(
        np.array([centre_lat]),
        np.array([centre_lon + 5 * rmw_nmi * deg_per_nmi]),
        centre_lat,
        centre_lon,
        vmax_kt=120,
        rmw_nmi=rmw_nmi,
        central_pressure_mb=940,
        env_pressure_mb=1006,
    )[0]

    assert at_rmw > far_out > 0


def test_wind_field_is_never_negative() -> None:
    grid = make_grid((85.3, 19.6, 86.4, 20.4), resolution_deg=0.02)
    lats, lons = grid_coords(grid)
    field = wind_field(lats, lons, 19.8, 85.8, 130, 25.0, 935, 1006)
    assert field.shape == lats.shape
    assert (field >= 0).all()


def test_haversine_known_distance() -> None:
    """Puri to Bhubaneswar is roughly 56 km."""
    d_km = haversine_m(np.array([19.81]), np.array([85.83]), 20.30, 85.82)[0] / 1000
    assert 50 < d_km < 62


def test_coriolis_is_non_negative_and_grows_with_latitude() -> None:
    assert coriolis(0.0) == pytest.approx(0.0, abs=1e-12)
    assert coriolis(20.0) < coriolis(45.0)


# --------------------------------------------------------------------------
# Inundation -- connectivity is the correctness-critical property
# --------------------------------------------------------------------------


def _dem_with_inland_depression() -> tuple[np.ndarray, np.ndarray]:
    """Coast on the left; a low basin inland that is NOT hydrologically connected."""
    dem = np.full((20, 20), 10.0)
    dem[:, :3] = -1.0  # sea
    dem[:, 3:6] = 1.0  # low-lying coastal strip, connected
    dem[8:12, 14:18] = 0.5  # inland depression, disconnected by high ground

    ocean = np.zeros_like(dem, dtype=bool)
    ocean[:, :3] = True
    return dem, ocean


def test_connectivity_excludes_disconnected_depression() -> None:
    dem, ocean = _dem_with_inland_depression()
    naive = naive_threshold(dem, 2.0)
    connected = connected_inundation(dem, 2.0, ocean)

    assert naive[8:12, 14:18].any(), "fixture should trigger the naive bug"
    assert not connected[8:12, 14:18].any(), "inland basin must not flood"
    assert connected[:, 3:6].any(), "connected coastal strip must flood"


def test_connected_is_always_subset_of_naive() -> None:
    """Quality gate G5."""
    dem, ocean = _dem_with_inland_depression()
    for level in (0.0, 1.0, 2.0, 5.0, 12.0):
        naive = naive_threshold(dem, level)
        connected = connected_inundation(dem, level, ocean)
        assert (connected & ~naive).sum() == 0


@given(level=st.floats(min_value=0.0, max_value=9.0, allow_nan=False))
@settings(max_examples=25, deadline=None)
def test_flood_area_is_monotonic_in_surge_level(level: float) -> None:
    """Quality gate G6: higher surge never floods less."""
    dem, ocean = _dem_with_inland_depression()
    lower = connected_inundation(dem, level, ocean).sum()
    higher = connected_inundation(dem, level + 1.0, ocean).sum()
    assert higher >= lower


def test_no_ocean_seed_yields_no_flood() -> None:
    dem, _ = _dem_with_inland_depression()
    empty_ocean = np.zeros_like(dem, dtype=bool)
    assert connected_inundation(dem, 5.0, empty_ocean).sum() == 0


def test_shape_mismatch_raises() -> None:
    with pytest.raises(ValueError, match="shape mismatch"):
        connected_inundation(np.zeros((4, 4)), 1.0, np.zeros((5, 5), dtype=bool))


def test_cell_area_is_plausible_for_odisha() -> None:
    area = cell_area_km2((85.3, 19.6, 86.4, 20.4), width=440, height=320)
    assert 0.03 < area < 0.12  # ~250 m cell


# --------------------------------------------------------------------------
# Surge -- the honesty contract
# --------------------------------------------------------------------------


def test_surge_always_carries_its_disclosure() -> None:
    """Contract test C2: a surge value cannot exist without its caveats."""
    est = DEFAULT_SURGE_MODEL.estimate(150, FUNNEL_AMPLIFICATION["central"])
    assert est.model_class == "heuristic_index"
    assert est.disclosure.limitations, "limitations must never be empty"
    assert any("heuristic" in limitation.lower() for limitation in est.disclosure.limitations)


def test_surge_calibration_stays_unverified() -> None:
    """The RMSE was fitted against recalled values, not primary sources.

    It must stay None until someone verifies against IMD Preliminary Reports.
    """
    assert DEFAULT_SURGE_MODEL.calibration_rmse_m is None


def test_surge_increases_with_wind_and_funnel() -> None:
    weak = DEFAULT_SURGE_MODEL.estimate(80, 1.0).peak_surge_m
    strong = DEFAULT_SURGE_MODEL.estimate(150, 1.0).peak_surge_m
    funnelled = DEFAULT_SURGE_MODEL.estimate(150, 1.6).peak_surge_m
    assert weak < strong < funnelled


def test_surge_surfaces_imd_forecast_alongside_ours() -> None:
    est = DEFAULT_SURGE_MODEL.estimate(150, 1.6, imd_forecast_surge_m="3.0-4.5")
    assert est.imd_forecast_surge_m == "3.0-4.5"


# --------------------------------------------------------------------------
# Track / RMW handling
# --------------------------------------------------------------------------


def _pt(time_str: str, rmw: float | None, wind: float = 100.0) -> TrackPoint:
    from datetime import datetime

    return TrackPoint(
        iso_time=datetime.fromisoformat(time_str),
        lat=19.0,
        lon=86.0,
        max_wind_kt=wind,
        rmw_nmi=rmw,
    )


def test_smoothing_rejects_implausibly_tight_rmw() -> None:
    """Fani's raw rows read 30 -> 5 -> 12 -> 5 nmi. 5 nmi must not survive."""
    points = [
        _pt("2019-05-02T00:00:00", 30.0),
        _pt("2019-05-02T06:00:00", 5.0),
        _pt("2019-05-02T12:00:00", 12.0),
        _pt("2019-05-02T18:00:00", 5.0),
    ]
    smoothed = smooth_rmw(points)
    assert all(p.rmw_nmi is not None and p.rmw_nmi >= RMW_MIN_NMI for p in smoothed)


def test_smoothing_flags_imputed_values() -> None:
    points = [_pt("2019-05-02T00:00:00", None), _pt("2019-05-02T06:00:00", 25.0)]
    smoothed = smooth_rmw(points)
    assert smoothed[0].rmw_imputed is True


def test_rmw_fallback_shrinks_with_intensity() -> None:
    assert rmw_from_intensity(140, 19.0) < rmw_from_intensity(60, 19.0)


def test_rmw_fallback_is_bounded() -> None:
    for wind in (0.0, 50.0, 200.0):
        for lat in (5.0, 25.0):
            assert RMW_MIN_NMI <= rmw_from_intensity(wind, lat) <= 120.0
