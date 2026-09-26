"""Track post-processing: RMW smoothing, landfall detection, peak intensity.

RMW MUST NOT BE USED RAW. Fani's own IBTrACS rows read 30 -> 5 -> 12 -> 5 nmi
near peak intensity. Eyewall contraction is physically real, but 5 nmi is
implausibly tight -- an artefact of Dvorak satellite estimation (there is no
aircraft reconnaissance in this basin). We smooth, fall back to an empirical
relation, and record every value we imputed.
"""

from __future__ import annotations

import numpy as np

from prahari.config.regions import coast_of
from prahari.models.track import CycloneTrack, LandfallEvent, TrackPoint

RMW_MIN_NMI = 8.0
RMW_MAX_NMI = 120.0


def rmw_from_intensity(vmax_kt: float, lat_deg: float) -> float:
    """Empirical RMW fallback when IBTrACS has none.

    Follows the established pattern that RMW shrinks with intensity and grows
    with latitude. Coefficients are illustrative, not fitted to this basin.
    """
    base = 60.0 - 0.35 * vmax_kt
    lat_term = 0.4 * abs(lat_deg)
    return float(np.clip(base + lat_term, RMW_MIN_NMI, RMW_MAX_NMI))


def smooth_rmw(points: list[TrackPoint], window: int = 3) -> list[TrackPoint]:
    """Rolling-median RMW with intensity fallback. Flags every imputed value."""
    raw = [p.rmw_nmi for p in points]
    out: list[TrackPoint] = []

    for i, point in enumerate(points):
        lo = max(0, i - window // 2)
        hi = min(len(raw), i + window // 2 + 1)
        neighbours = [v for v in raw[lo:hi] if v is not None and v >= RMW_MIN_NMI]

        if neighbours:
            value = float(np.median(neighbours))
            imputed = point.rmw_nmi is None or point.rmw_nmi < RMW_MIN_NMI
        elif point.max_wind_kt is not None:
            value = rmw_from_intensity(point.max_wind_kt, point.lat)
            imputed = True
        else:
            value = 30.0
            imputed = True

        out.append(
            point.model_copy(
                update={
                    "rmw_nmi": float(np.clip(value, RMW_MIN_NMI, RMW_MAX_NMI)),
                    "rmw_imputed": bool(imputed),
                }
            )
        )
    return out


def detect_landfall(points: list[TrackPoint]) -> LandfallEvent | None:
    """First point where DIST2LAND reaches zero (IBTrACS semantics).

    Crossing an island (the Andamans, Sri Lanka) also reads zero, and a storm
    that crossed over from the Pacific carries its first landfall from there.
    So the first mainland landfall on a configured coast wins, then an island
    one, then any.
    """
    land = [p for p in points if p.dist2land_km is not None and p.dist2land_km <= 0]
    if not land:
        return None
    coasts = [(p, coast_of(p.lat, p.lon)) for p in land]
    mainland = [p for p, c in coasts if c is not None and not c.island]
    island = [p for p, c in coasts if c is not None]
    point = (mainland or island or land)[0]
    return LandfallEvent(
        iso_time=point.iso_time,
        lat=point.lat,
        lon=point.lon,
        max_wind_kt=point.max_wind_kt,
    )


def peak_intensity(track: CycloneTrack) -> TrackPoint:
    return max(track.points, key=lambda p: p.max_wind_kt or 0.0)
