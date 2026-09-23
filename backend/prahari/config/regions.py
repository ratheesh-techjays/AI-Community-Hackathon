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


class AOIParams(BaseModel):
    """Per-AOI parameters. Funnel keys come from hazard/surge.py FUNNEL_AMPLIFICATION."""

    label: str
    district_label: str  # the Collector's district, for order wording
    funnel_key: str


AOI_PARAMS: dict[str, AOIParams] = {
    "puri_khordha": AOIParams(label="Puri + Khordha", district_label="Puri", funnel_key="central"),
    "balasore_bhadrak": AOIParams(
        label="Balasore + Bhadrak", district_label="Balasore", funnel_key="head_of_bay"
    ),
}


class SarWindowSpec(BaseModel):
    """Same orbit direction pre and post -- never mix ASC and DSC."""

    orbit_pass: str
    pre_start: str
    pre_end: str
    post_start: str
    post_end: str


# Verified scene availability (EE queries, 2026-09-23):
# Fani / puri_khordha: DSC relative orbit 48, pre 2019-04-22/28, post 2019-05-04.
# Yaas / balasore_bhadrak: ASC relative orbit 12, pre 2021-05-14, post 2021-05-26
# (the landfall day itself).
SAR_WINDOWS: dict[tuple[str, int], SarWindowSpec] = {
    ("FANI", 2019): SarWindowSpec(
        orbit_pass="DESCENDING",
        pre_start="2019-04-20",
        pre_end="2019-05-02",
        post_start="2019-05-04",
        post_end="2019-05-05",
    ),
    ("YAAS", 2021): SarWindowSpec(
        orbit_pass="ASCENDING",
        pre_start="2021-05-10",
        pre_end="2021-05-16",
        post_start="2021-05-26",
        post_end="2021-05-27",
    ),
}
