"""Provenance and limitations endpoints.

Powers the "where does this data come from" panel. Single source of truth for
limitations, shared by the UI panel, advisory caveats, and ModelDisclosure.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from prahari.models.disclosure import PARAMETRIC_LIMITATIONS, SURGE_LIMITATIONS

router = APIRouter(tags=["meta"])


class SourceDescriptor(BaseModel):
    source_id: str
    authority: str
    url: str | None = None
    licence: str
    role: str
    is_synthetic: bool = False
    confidence: str


SOURCES: list[SourceDescriptor] = [
    SourceDescriptor(
        source_id="ibtracs.ni.v04r01",
        authority="NOAA NCEI",
        url="https://www.ncei.noaa.gov/products/international-best-track-archive",
        licence="public domain",
        role="Cyclone best-track (historical + active)",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="osdma.shelters",
        authority="Odisha State Disaster Management Authority",
        url="https://www.osdma.org/shelter-locations/",
        licence="public",
        role="877 geocoded cyclone and flood shelters",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="gee.copernicus_dem_glo30_2024_1",
        authority="ESA / Copernicus",
        licence="Copernicus licence",
        role="Elevation model for inundation",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="gee.open_buildings_v3",
        authority="Google Research",
        url="https://sites.research.google/gr/open-buildings/",
        licence="CC-BY-4.0",
        role="Building footprint exposure",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="gee.worldpop",
        authority="WorldPop",
        licence="CC-BY-4.0",
        role="Population exposure",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="gee.sentinel1_grd",
        authority="ESA / Copernicus",
        licence="Copernicus licence",
        role="Observed flood extent, used as evaluation ground truth",
        confidence="HIGH",
    ),
    SourceDescriptor(
        source_id="open_meteo.archive",
        authority="Open-Meteo",
        url="https://open-meteo.com/",
        licence="CC-BY-4.0",
        role="Rainfall and wind corroboration",
        confidence="MEDIUM",
    ),
    SourceDescriptor(
        source_id="prahari.parametric_zones",
        authority="PRAHARI (illustrative)",
        licence="n/a",
        role="Parametric trigger zones",
        is_synthetic=True,
        confidence="DERIVED",
    ),
]


class SourcesResponse(BaseModel):
    sources: list[SourceDescriptor]


class LimitationsResponse(BaseModel):
    surge: list[str]
    parametric: list[str]
    general: list[str]


@router.get("/meta/sources", response_model=SourcesResponse)
async def list_sources() -> SourcesResponse:
    return SourcesResponse(sources=SOURCES)


@router.get("/meta/limitations", response_model=LimitationsResponse)
async def limitations() -> LimitationsResponse:
    return LimitationsResponse(
        surge=SURGE_LIMITATIONS,
        parametric=PARAMETRIC_LIMITATIONS,
        general=[
            "PRAHARI does not replace IMD forecasts. It consumes them and "
            "translates them into asset-level consequence.",
            "Mortality early warning in India already works well. This system "
            "targets asset and infrastructure loss, not casualty prediction.",
        ],
    )
