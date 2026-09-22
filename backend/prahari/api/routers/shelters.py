"""Shelter endpoints backed by the banked OSDMA dataset (877 records)."""

from __future__ import annotations

import csv
from functools import lru_cache

from fastapi import APIRouter, Query
from pydantic import BaseModel

from prahari.config.paths import OSDMA_SHELTERS_CSV as SHELTERS_CSV

router = APIRouter(tags=["shelters"])

# Data-quality normalisation. OSDMA publishes both spellings of one district
# and two separators for one shelter type. See docs/design/03-data-layer.md.
DISTRICT_CANON = {"JAGATSINGPUR": "JAGATSINGHPUR"}
TYPE_CANON = {"NCRMP_AF": "NCRMP-AF"}


class Shelter(BaseModel):
    name: str
    lat: float
    lon: float
    district: str
    block: str | None = None
    village: str | None = None
    shelter_type: str


class SheltersResponse(BaseModel):
    count: int
    shelters: list[Shelter]


@lru_cache
def _load() -> list[Shelter]:
    if not SHELTERS_CSV.exists():
        return []
    rows: list[Shelter] = []
    with SHELTERS_CSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            district = DISTRICT_CANON.get(row["district"], row["district"])
            shelter_type = TYPE_CANON.get(row["shelter"], row["shelter"]) or "UNKNOWN"
            rows.append(
                Shelter(
                    name=row["name"],
                    lat=float(row["lat"]),
                    lon=float(row["lon"]),
                    district=district,
                    block=row.get("block") or None,
                    village=row.get("village") or None,
                    shelter_type=shelter_type,
                )
            )
    return rows


@router.get("/shelters", response_model=SheltersResponse)
async def list_shelters(
    district: str | None = Query(None, description="Case-insensitive district filter"),
    shelter_type: str | None = Query(None),
) -> SheltersResponse:
    rows = _load()
    if district:
        wanted = DISTRICT_CANON.get(district.upper(), district.upper())
        rows = [s for s in rows if s.district == wanted]
    if shelter_type:
        rows = [s for s in rows if s.shelter_type == shelter_type]
    return SheltersResponse(count=len(rows), shelters=rows)
