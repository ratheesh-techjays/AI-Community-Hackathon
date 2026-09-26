"""Storm catalogue: built from IBTrACS rows, never a hand list."""

from __future__ import annotations

from prahari.config.regions import coast_of, derive_aoi
from prahari.hazard.track import detect_landfall
from prahari.ingestion.tracks import catalogue
from prahari.ingestion.tracks.ibtracs import parse

COLUMNS = [
    "SID", "SEASON", "NAME", "ISO_TIME", "LAT", "LON", "DIST2LAND",
    "USA_WIND", "USA_PRES", "USA_POCI", "USA_RMW", "STORM_SPEED", "STORM_DIR",
]  # fmt: skip


def _rows(sid: str, name: str, season: int, points: list[tuple[float, float, float]]) -> list[str]:
    """points: (lat, lon, dist2land_km), six hours apart."""
    out = []
    for i, (lat, lon, d2l) in enumerate(points):
        day, hour = 1 + (i * 6) // 24, (i * 6) % 24
        when = f"{season}-05-{day:02d} {hour:02d}:00:00"
        out.append(f"{sid},{season},{name},{when},{lat},{lon},{d2l},90,960,1005,20,10,0")
    return out


def _csv(*storms: list[str]) -> str:
    lines = [",".join(COLUMNS), ",".join(" " for _ in COLUMNS)]
    for rows in storms:
        lines.extend(rows)
    return "\n".join(lines) + "\n"


ODISHA = [(17.0, 87.0, 300), (18.0, 86.5, 200), (19.0, 86.0, 100), (20.2, 85.9, 0), (20.8, 85.7, 0)]
ANDAMAN_THEN_AP = [
    (11.0, 93.5, 100), (11.6, 92.7, 0), (12.5, 90.0, 300), (15.0, 85.0, 200),
    (16.5, 82.5, 50), (17.8, 83.1, 0), (18.3, 82.8, 0),
]  # fmt: skip
AT_SEA = [(12.0, 88.0, 500), (13.0, 88.5, 450), (14.0, 89.0, 400), (15.0, 89.5, 380)]
OUTSIDE = [(15.0, 60.0, 300), (16.0, 57.0, 100), (16.5, 54.0, 0), (16.8, 53.0, 0)]


def test_every_named_storm_is_listed_and_unnamed_ones_are_not() -> None:
    text = _csv(
        _rows("A", "ALPHA", 2019, ODISHA),
        _rows("B", "UNNAMED", 2019, ODISHA),
        _rows("C", "GAMMA:OTHER", 2020, AT_SEA),
    )
    names = {e.name for e in catalogue.build(text)}
    assert names == {"ALPHA", "GAMMA"}


def test_odisha_landfall_is_modellable_and_attributed() -> None:
    (e,) = catalogue.build(_csv(_rows("A", "ALPHA", 2019, ODISHA)))
    assert e.landfall_coast == "Odisha"
    assert e.landfall_country == "India"
    assert e.not_modellable is None
    assert e.no_sar_reason is None


def test_island_crossing_is_not_the_landfall() -> None:
    track = parse(_csv(_rows("A", "ALPHA", 2019, ANDAMAN_THEN_AP)), "ALPHA", 2019)
    landfall = detect_landfall(track.points)
    assert landfall is not None
    assert (landfall.lat, landfall.lon) == (17.8, 83.1)
    coast = coast_of(landfall.lat, landfall.lon)
    assert coast is not None and coast.name == "Andhra Pradesh"


def test_no_landfall_and_outside_coverage_say_why() -> None:
    entries = {
        e.name: e
        for e in catalogue.build(
            _csv(_rows("A", "ATSEA", 2019, AT_SEA), _rows("B", "FAR", 2019, OUTSIDE))
        )
    }
    assert entries["ATSEA"].not_modellable == "Never made landfall in the best track."
    assert entries["ATSEA"].no_sar_reason is not None
    assert "outside" in (entries["FAR"].not_modellable or "")


def test_pre_sentinel1_storm_cannot_be_scored() -> None:
    (e,) = catalogue.build(_csv(_rows("A", "OLD", 2013, ODISHA)))
    assert e.not_modellable is None
    assert "Sentinel-1" in (e.no_sar_reason or "")


def test_no_sar_truth_storms_are_never_scorable() -> None:
    (e,) = catalogue.build(_csv(_rows("A", "MICHAUNG", 2023, ANDAMAN_THEN_AP)))
    assert "No usable post-landfall Sentinel-1" in (e.no_sar_reason or "")


def test_derived_aoi_contains_the_landfall() -> None:
    minlon, minlat, maxlon, maxlat = derive_aoi(17.8, 83.1)
    assert minlon < 83.1 < maxlon and minlat < 17.8 < maxlat
    assert maxlon - minlon <= 1.2 and maxlat - minlat <= 0.9
