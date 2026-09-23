"""PCRIC-style dual parametric trigger, per block zone.

Trigger A: peak modelled wind in the zone. Trigger B: impacted-population
index (share of the zone's people inside the modelled flood). The zone pays
the larger of the two fractions of its limit. Thresholds and the limit are
ILLUSTRATIVE of the mechanism, not actuarially derived; the response says so
in a Literal field (contract test C4).
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from prahari.models.results import TriggerDetail, ZoneTrigger

ZONE_LIMIT_INR = 50 * 10**7  # 50 crore per block zone, illustrative
WIND_TIERS_MS: list[tuple[float, float, str]] = [
    (50.0, 1.0, "wind >= 50 m/s"),
    (42.0, 0.5, "wind >= 42 m/s"),
    (33.0, 0.25, "wind >= 33 m/s"),
]
POPULATION_TIERS: list[tuple[float, float, str]] = [
    (0.20, 1.0, "index >= 0.20"),
    (0.10, 0.5, "index >= 0.10"),
    (0.05, 0.25, "index >= 0.05"),
]


def _tier(value: float, tiers: list[tuple[float, float, str]]) -> tuple[float, str | None]:
    for threshold, fraction, label in tiers:
        if value >= threshold:
            return fraction, label
    return 0.0, None


def zone_triggers(
    zone_of_cell: np.ndarray,
    zone_names: list[str],
    wind_ms: np.ndarray,
    population: np.ndarray,
    flooded: np.ndarray,
) -> list[ZoneTrigger]:
    """zone_of_cell holds an index into zone_names per grid cell, -1 = none."""
    stats: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    valid = zone_of_cell >= 0
    for z in np.unique(zone_of_cell[valid]):
        in_zone = zone_of_cell == z
        s = stats[int(z)]
        s["wind"] = float(wind_ms[in_zone].max())
        s["pop"] = float(population[in_zone].sum())
        s["pop_flooded"] = float(population[in_zone & flooded].sum())

    out = []
    for z, s in sorted(stats.items(), key=lambda t: zone_names[t[0]]):
        index = s["pop_flooded"] / s["pop"] if s["pop"] > 0 else 0.0
        fa, la = _tier(s["wind"], WIND_TIERS_MS)
        fb, lb = _tier(index, POPULATION_TIERS)
        payout = ZONE_LIMIT_INR * max(fa, fb)
        out.append(
            ZoneTrigger(
                zone_id=f"Z-{zone_names[z]}",
                zone_name=zone_names[z],
                trigger_a_wind=TriggerDetail(
                    metric="peak_wind_ms",
                    value=round(s["wind"], 1),
                    threshold_hit=la,
                    payout_fraction=fa,
                ),
                trigger_b_population_index=TriggerDetail(
                    metric="flooded_population_share",
                    value=round(index, 3),
                    threshold_hit=lb,
                    payout_fraction=fb,
                ),
                payout_inr=payout,
                triggered=payout > 0,
            )
        )
    return out
