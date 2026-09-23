"""Shelter endpoints backed by the banked OSDMA register (877 records)."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from prahari.ingestion.shelters import DISTRICT_CANON, ShelterRecord, load_register

router = APIRouter(tags=["shelters"])


class SheltersResponse(BaseModel):
    count: int
    shelters: list[ShelterRecord]


@router.get("/shelters", response_model=SheltersResponse)
async def list_shelters(
    district: str | None = Query(None, max_length=40, description="Case-insensitive district"),
    shelter_type: str | None = Query(None, max_length=40),
) -> SheltersResponse:
    rows = load_register()
    if district:
        wanted = DISTRICT_CANON.get(district.upper(), district.upper())
        rows = [s for s in rows if s.district == wanted]
    if shelter_type:
        rows = [s for s in rows if s.shelter_type == shelter_type]
    return SheltersResponse(count=len(rows), shelters=rows)
