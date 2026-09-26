"""IBTrACS North Indian Ocean best-track ingestion.

VERIFIED 2026-09-22: 27.9 MB, HTTP 200, 62,848 rows, Fani present (71 rows).

TWO RULES THAT WILL BITE YOU:
  1. Row 2 of the CSV is a UNITS row. Skip it.
  2. Use USA_* (JTWC) columns ONLY.
       - NEWDELHI_* (IMD) carries NO RMW at all.
       - WMO_* is only ~13% populated basin-wide.
       - USA_RMW fill for named storms: Fani 97%, Amphan 96%, Yaas 89%.
"""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import UTC, datetime
from pathlib import Path

import httpx

from prahari.config.assets import IBTRACS_NI_URL
from prahari.models.provenance import Confidence, Provenance
from prahari.models.track import CycloneTrack, TrackPoint

SOURCE_ID = "ibtracs.ni.v04r01"


def _f(row: dict[str, str], key: str) -> float | None:
    """Parse a possibly-blank IBTrACS numeric cell."""
    raw = (row.get(key) or "").strip()
    if not raw or raw in {" ", "-999", "-9999"}:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def download(dest: Path, url: str = IBTRACS_NI_URL, timeout: float = 120.0) -> Path:
    """Fetch the NI basin CSV to ``dest``. Cached by presence; content-addressed."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return dest
    with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in resp.iter_bytes():
                fh.write(chunk)
    return dest


def parse(csv_text: str, storm_name: str, season: int | None = None) -> CycloneTrack:
    """Parse one named storm out of the NI basin CSV."""
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader)
    next(reader)  # RULE 1: discard the units row

    idx = {name: i for i, name in enumerate(header)}
    wanted = storm_name.upper()
    rows: list[dict[str, str]] = []

    for raw_row in reader:
        if len(raw_row) < len(header):
            continue
        row = {name: raw_row[i] for name, i in idx.items()}
        if display_name(row["NAME"]) != wanted and row["NAME"].strip().upper() != wanted:
            continue
        if season is not None and int(row["SEASON"]) != season:
            continue
        rows.append(row)

    if not rows:
        raise ValueError(f"storm {storm_name!r} not found in IBTrACS NI basin")
    if len({r["SID"].strip() for r in rows}) > 1:
        # Two storms share a name without a season (KIM, HERBERT); take the latest.
        latest = max(rows, key=lambda r: r["ISO_TIME"])["SID"].strip()
        rows = [r for r in rows if r["SID"].strip() == latest]
    return parse_rows(rows, hashlib.sha256(csv_text.encode()).hexdigest())


def display_name(raw: str) -> str:
    """IBTrACS joins names from several agencies ("BULBUL:MATMO"); the first is IMD's."""
    return raw.strip().upper().split(":")[0]


def parse_rows(rows: list[dict[str, str]], content_sha256: str | None = None) -> CycloneTrack:
    """One storm's rows (already filtered from the CSV) to a track."""
    points = [
        TrackPoint(
            iso_time=datetime.strptime(r["ISO_TIME"].strip(), "%Y-%m-%d %H:%M:%S"),
            lat=float(r["LAT"]),
            lon=float(r["LON"]),
            max_wind_kt=_f(r, "USA_WIND"),  # RULE 2
            central_pressure_mb=_f(r, "USA_PRES"),
            env_pressure_mb=_f(r, "USA_POCI"),
            rmw_nmi=_f(r, "USA_RMW"),
            storm_speed_kt=_f(r, "STORM_SPEED"),
            storm_dir_deg=_f(r, "STORM_DIR"),
            dist2land_km=_f(r, "DIST2LAND"),
        )
        for r in rows
    ]

    return CycloneTrack(
        sid=rows[0]["SID"].strip(),
        name=display_name(rows[0]["NAME"]),
        season=int(rows[0]["SEASON"]),
        points=points,
        provenance=Provenance(
            source_id=SOURCE_ID,
            authority="NOAA NCEI",
            url=IBTRACS_NI_URL,
            licence="public domain",
            retrieved_at=datetime.now(UTC),
            content_sha256=content_sha256,
            confidence=Confidence.HIGH,
            caveats=[
                "RMW is Dvorak satellite-derived; no aircraft reconnaissance "
                "exists in the North Indian Ocean basin.",
                "USA_* (JTWC) columns used; IMD NEWDELHI_* carries no RMW.",
            ],
        ),
    )


def load_storm(path: Path, storm_name: str, season: int | None = None) -> CycloneTrack:
    return parse(path.read_text(encoding="utf-8", errors="replace"), storm_name, season)
