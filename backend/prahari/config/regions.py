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
    state: str = "Odisha"
    country: str = "India"


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


class CoastSegment(BaseModel):
    """A stretch of coast a landfall point is attributed to.

    Boxes are coarse and checked in order, first match wins, so a narrower
    segment is listed before the broader one it overlaps. They only name the
    coast and pick the surge funnel; they draw no administrative boundary.
    """

    name: str
    country: str
    bbox: tuple[float, float, float, float]  # minlon, minlat, maxlon, maxlat
    funnel_key: str  # hazard/surge.py FUNNEL_AMPLIFICATION
    island: bool = False


LANDFALL_COASTS: tuple[CoastSegment, ...] = (
    CoastSegment(
        name="Andaman and Nicobar Islands",
        country="India",
        bbox=(92.0, 6.0, 94.5, 14.0),
        funnel_key="central",
        island=True,
    ),
    CoastSegment(
        name="Sri Lanka",
        country="Sri Lanka",
        bbox=(79.65, 5.8, 82.0, 9.9),
        funnel_key="south",
        island=True,
    ),
    CoastSegment(
        name="Tamil Nadu", country="India", bbox=(77.2, 8.0, 80.45, 13.55), funnel_key="south"
    ),
    CoastSegment(
        name="Andhra Pradesh",
        country="India",
        bbox=(79.9, 13.55, 84.8, 19.15),
        funnel_key="central",
    ),
    # North Odisha sits at the head of the bay, like Balasore for Yaas.
    CoastSegment(
        name="Odisha", country="India", bbox=(85.5, 20.9, 87.45, 21.65), funnel_key="head_of_bay"
    ),
    CoastSegment(
        name="Odisha", country="India", bbox=(84.8, 19.0, 87.45, 21.65), funnel_key="central"
    ),
    CoastSegment(
        name="West Bengal",
        country="India",
        bbox=(87.45, 21.5, 89.1, 23.5),
        funnel_key="head_of_bay",
    ),
    CoastSegment(
        name="Bangladesh",
        country="Bangladesh",
        bbox=(89.1, 20.6, 92.7, 24.5),
        funnel_key="head_of_bay",
    ),
    CoastSegment(
        name="Myanmar", country="Myanmar", bbox=(92.2, 15.5, 95.5, 20.8), funnel_key="central"
    ),
    CoastSegment(
        name="Kerala", country="India", bbox=(74.8, 8.2, 77.2, 12.8), funnel_key="central"
    ),
    CoastSegment(
        name="Karnataka and Goa",
        country="India",
        bbox=(73.5, 12.8, 75.0, 15.8),
        funnel_key="central",
    ),
    CoastSegment(
        name="Maharashtra", country="India", bbox=(72.5, 15.8, 74.0, 20.1), funnel_key="central"
    ),
    CoastSegment(
        name="Gujarat", country="India", bbox=(68.0, 20.1, 74.5, 24.7), funnel_key="central"
    ),
    CoastSegment(
        name="Pakistan", country="Pakistan", bbox=(61.0, 23.5, 68.0, 26.0), funnel_key="central"
    ),
    CoastSegment(name="Oman", country="Oman", bbox=(52.0, 16.5, 60.0, 24.0), funnel_key="central"),
)


def coast_of(lat: float, lon: float) -> CoastSegment | None:
    """The coast segment a landfall point falls on, or None outside every box."""
    return next(
        (
            c
            for c in LANDFALL_COASTS
            if c.bbox[0] <= lon <= c.bbox[2] and c.bbox[1] <= lat <= c.bbox[3]
        ),
        None,
    )


# A landfall-derived AOI: the landfall point with this half-width and
# half-height in degrees. Puri + Khordha, the Fani preset, is 1.1 x 0.8 deg.
AUTO_AOI = "auto"
AUTO_AOI_HALF_LON = 0.55
AUTO_AOI_HALF_LAT = 0.4
# Where the pipeline's Earth Engine layers are known to hold together. GLO-30
# and WorldPop are global, but Open Buildings v3 covers South and Southeast
# Asia (not the Arabian Peninsula), and the surge funnels are Bay of Bengal
# numbers. A landfall outside this box is refused, not modelled badly.
LAYER_COVERAGE_BBOX = (60.0, 5.0, 100.0, 26.5)


def derive_aoi(lat: float, lon: float) -> tuple[float, float, float, float]:
    return (
        round(lon - AUTO_AOI_HALF_LON, 3),
        round(lat - AUTO_AOI_HALF_LAT, 3),
        round(lon + AUTO_AOI_HALF_LON, 3),
        round(lat + AUTO_AOI_HALF_LAT, 3),
    )


# Storms with no usable post-landfall Sentinel-1 imagery (verified by scene
# search). Validation for these is refused with 424, never scored.
NO_SAR_TRUTH = frozenset({"MICHAUNG", "REMAL", "BIPARJOY"})

# Independent references that exist but are not ingested yet.
EMS_ACTIVATIONS: dict[str, str] = {
    "FANI": "Copernicus EMS EMSR357 exists as an independent reference; not yet ingested.",
}

# Curated context shown beside a catalogue entry. Facts only.
STORM_NOTES: dict[tuple[str, int], str] = {
    ("FANI", 2019): (
        "The only Indian cyclone with a Copernicus EMS activation (EMSR357). Its Sentinel-1 "
        "score is 0.001: the flood extent is heuristic."
    ),
    ("YAAS", 2021): ("A same-orbit Sentinel-1 pair exists, but nothing in its swath was scorable."),
    ("MICHAUNG", 2023): "Never validated: no post-landfall Sentinel-1 imagery exists.",
    ("REMAL", 2024): "Never validated: no post-landfall Sentinel-1 imagery exists.",
}
