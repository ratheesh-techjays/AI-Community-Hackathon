"""OSDMA shelter register: one loader for the API and the pipeline.

The committed CSV was scraped from an embedded JS array, and its columns are
shifted: `block` usually repeats the shelter name, and the real block name
lives in `village` (ASTARANGA, BRAMHAGIRI, KRUSHNAPRASAD, ...). See
docs/design/03-data-layer.md, "block frequently duplicates name".

The register has no id and no capacity. `register_id` is the 1-based CSV row,
which is stable because the file is committed and never regenerated.
Capacity is imputed from shelter type and flagged DERIVED.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from prahari.config.paths import OSDMA_SHELTERS_CSV

DISTRICT_CANON = {"JAGATSINGPUR": "JAGATSINGHPUR", "KHURDA": "KHORDHA"}
TYPE_CANON = {"NCRMP_AF": "NCRMP-AF"}
BLOCK_CANON = {"BRAMHAGIRI": "BRAHMAGIRI"}

# Illustrative imputation from shelter type (03-data-layer.md). DERIVED, shown
# in the UI as an assumption. Purpose-built multipurpose cyclone shelters are
# the large ones; the rest are sized conservatively.
CAPACITY_BY_TYPE: dict[str, int] = {
    "MCS": 1000,
    "MCS(CMRF)": 1000,
    "NCRMP": 1000,
    "NCRMP-AF": 1000,
    "ICZMP": 1000,
    "MFS(CMRF)": 500,
    "MFS(St.Plan)": 500,
    "IRCS": 500,
    "CCI": 500,
    "CMRF": 500,
}
UNKNOWN_TYPE = "UNKNOWN"


class ShelterRecord(BaseModel):
    register_id: str
    name: str
    lat: float
    lon: float
    district: str
    block: str | None
    locality: str | None
    shelter_type: str
    capacity: int  # 0 when the type is unknown: excluded from assignment
    capacity_imputed: bool = True


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def load_register(path: Path = OSDMA_SHELTERS_CSV) -> list[ShelterRecord]:
    return list(_load(str(path)))


@lru_cache
def _load(path: str) -> tuple[ShelterRecord, ...]:
    file = Path(path)
    if not file.exists():
        return ()
    records: list[ShelterRecord] = []
    with file.open(encoding="utf-8") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            district = row["district"].strip().upper()
            block = _clean(row.get("village"))
            if block:
                block = BLOCK_CANON.get(block.upper(), block.upper())
            shelter_type = TYPE_CANON.get(row["shelter"], row["shelter"]) or UNKNOWN_TYPE
            records.append(
                ShelterRecord(
                    register_id=f"OSDMA-{index:04d}",
                    name=row["name"].strip(),
                    lat=float(row["lat"]),
                    lon=float(row["lon"]),
                    district=DISTRICT_CANON.get(district, district),
                    block=block,
                    locality=_clean(row.get("block")),
                    shelter_type=shelter_type,
                    capacity=CAPACITY_BY_TYPE.get(shelter_type, 0),
                )
            )
    return tuple(records)


def in_bbox(
    records: list[ShelterRecord], bbox: tuple[float, float, float, float]
) -> list[ShelterRecord]:
    minlon, minlat, maxlon, maxlat = bbox
    return [r for r in records if minlon <= r.lon <= maxlon and minlat <= r.lat <= maxlat]
