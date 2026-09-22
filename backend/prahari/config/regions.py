"""Region parameters. Scaling to a new coastline is a config change, not code.

funnel_amplification reflects Bay of Bengal shelf geometry. These are
ILLUSTRATIVE coefficients -- see SurgeModel docstring for the honesty caveat.
"""

from __future__ import annotations

from pydantic import BaseModel


class RegionParams(BaseModel):
    name: str
    funnel_amplification: float
    bbox: tuple[float, float, float, float]  # minlon, minlat, maxlon, maxlat


REGIONS: dict[str, RegionParams] = {
    "odisha": RegionParams(name="Odisha", funnel_amplification=1.6, bbox=(81.4, 17.8, 87.5, 22.6)),
    "west_bengal": RegionParams(
        name="West Bengal", funnel_amplification=1.6, bbox=(85.8, 21.5, 89.9, 27.2)
    ),
    "andhra_pradesh": RegionParams(
        name="Andhra Pradesh", funnel_amplification=1.0, bbox=(76.7, 12.6, 84.8, 19.9)
    ),
    "tamil_nadu": RegionParams(
        name="Tamil Nadu", funnel_amplification=0.7, bbox=(76.2, 8.0, 80.3, 13.6)
    ),
}

AOI_PRESETS: dict[str, tuple[float, float, float, float]] = {
    # Fani landfall district + neighbour. Puri holds 177 of Odisha's 877 shelters.
    "puri_khordha": (85.3, 19.6, 86.4, 20.4),
    "balasore_bhadrak": (86.5, 20.7, 87.5, 21.9),
}
