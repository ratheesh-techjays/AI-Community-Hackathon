"""Holland (1980) parametric tropical cyclone wind field.

Pure numpy. No I/O, no dependencies beyond numpy -- deliberately NOT CLIMADA,
which pulls 52 packages including GDAL and is a Cloud Run build risk (ADR-004).

    P(r) = Pc + (Pn - Pc) * exp[-(RMW/r)^B]
    V(r) = sqrt[ B*(Pn-Pc)*(RMW/r)^B * exp(-(RMW/r)^B)/rho + (r*f/2)^2 ] - r*f/2

B is not observed. It is inverted from the cyclostrophic relation:
    B = Vmax^2 * rho * e / dP
and clipped to a physically plausible range.
"""

from __future__ import annotations

import numpy as np

RHO_AIR = 1.15  # kg/m^3
OMEGA = 7.2921e-5  # rad/s, Earth rotation
KT_TO_MS = 0.514444
NMI_TO_M = 1852.0
B_MIN, B_MAX = 1.0, 2.5


def coriolis(lat_deg: float) -> float:
    """Coriolis parameter f = 2*omega*sin(lat). Always non-negative here."""
    return float(abs(2.0 * OMEGA * np.sin(np.radians(lat_deg))))


def holland_b(vmax_ms: float, pressure_deficit_pa: float) -> float:
    """Invert the cyclostrophic relation for the Holland shape parameter."""
    if pressure_deficit_pa <= 0 or vmax_ms <= 0:
        return 1.5  # neutral default
    b = (vmax_ms**2) * RHO_AIR * np.e / pressure_deficit_pa
    return float(np.clip(b, B_MIN, B_MAX))


def gradient_wind(
    r_m: np.ndarray,
    rmw_m: float,
    pressure_deficit_pa: float,
    b: float,
    lat_deg: float,
) -> np.ndarray:
    """Holland gradient wind at radius r. Returns m/s, same shape as r_m."""
    r = np.maximum(np.asarray(r_m, dtype=float), 1.0)  # avoid r=0 singularity
    f = coriolis(lat_deg)
    ratio = (rmw_m / r) ** b
    term = b * pressure_deficit_pa * ratio * np.exp(-ratio) / RHO_AIR
    coriolis_term = (r * f / 2.0) ** 2
    return np.asarray(np.sqrt(np.maximum(term + coriolis_term, 0.0)) - (r * f / 2.0), dtype=float)


def haversine_m(
    lat1: np.ndarray | float,
    lon1: np.ndarray | float,
    lat2: float,
    lon2: float,
) -> np.ndarray:
    """Great-circle distance in metres."""
    r_earth = 6_371_000.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return np.asarray(2 * r_earth * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0))), dtype=float)


def wind_field(
    lats: np.ndarray,
    lons: np.ndarray,
    centre_lat: float,
    centre_lon: float,
    vmax_kt: float,
    rmw_nmi: float,
    central_pressure_mb: float,
    env_pressure_mb: float = 1010.0,
) -> np.ndarray:
    """Max sustained wind (m/s) on a lat/lon grid for one track position.

    lats, lons must broadcast together (e.g. from np.meshgrid).
    """
    vmax_ms = vmax_kt * KT_TO_MS
    rmw_m = rmw_nmi * NMI_TO_M
    dp_pa = max((env_pressure_mb - central_pressure_mb) * 100.0, 0.0)
    b = holland_b(vmax_ms, dp_pa)
    r_m = haversine_m(lats, lons, centre_lat, centre_lon)
    v = gradient_wind(r_m, rmw_m, dp_pa, b, centre_lat)
    return np.asarray(np.maximum(v, 0.0), dtype=float)


def track_max_wind_field(
    lats: np.ndarray,
    lons: np.ndarray,
    positions: list[dict[str, float]],
) -> np.ndarray:
    """Envelope of maximum wind across every track position.

    positions: [{lat, lon, vmax_kt, rmw_nmi, pressure_mb, env_pressure_mb}, ...]
    """
    out = np.zeros(np.broadcast(lats, lons).shape, dtype=float)
    for p in positions:
        out = np.maximum(
            out,
            wind_field(
                lats,
                lons,
                p["lat"],
                p["lon"],
                p["vmax_kt"],
                p["rmw_nmi"],
                p["pressure_mb"],
                p.get("env_pressure_mb", 1010.0),
            ),
        )
    return out
