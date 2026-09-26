"""Any North Indian Ocean cyclone: landfall-derived AOI, coverage, honest gaps.

Runs on synthetic layers (no network). The synthetic storm is moved to other
coasts by shifting its track; the coastline is grid-relative, so every AOI
still has open sea to seed the flood from.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prahari.ai.advisories import build_advisories
from prahari.ai.client import AIClient
from prahari.api.errors import NoLandfallError, OutsideCoverageError, TrackTooShortError
from prahari.api.main import app
from prahari.api.service import ScenarioService, get_scenario_service
from prahari.config.settings import Settings
from prahari.ingestion.shelters import load_register
from prahari.models.results import RunResult
from prahari.models.track import CycloneTrack, LandfallEvent
from prahari.storage.runs import RunStore
from prahari.workers.scenario import (
    PipelineInputs,
    check_modellable,
    run_pipeline,
    stored_coverage,
)
from tests.synthetic import SyntheticLayers, synthetic_track


def shifted(dlat: float, dlon: float, name: str = "SHIFT", year: int | None = None) -> CycloneTrack:
    """The synthetic storm moved by (dlat, dlon), optionally to another year."""
    base = synthetic_track(name)

    def when(t: datetime) -> datetime:
        return t.replace(year=year) if year else t

    points = [
        p.model_copy(
            update={"lat": p.lat + dlat, "lon": p.lon + dlon, "iso_time": when(p.iso_time)}
        )
        for p in base.points
    ]
    lf = base.landfall
    assert lf is not None
    landfall = LandfallEvent(
        iso_time=when(lf.iso_time), lat=lf.lat + dlat, lon=lf.lon + dlon, max_wind_kt=lf.max_wind_kt
    )
    return base.model_copy(update={"points": points, "landfall": landfall})


# Synthetic landfall is at (19.8, 85.76), Odisha. These move it to Hudhud's
# Visakhapatnam landfall, to Oman, and keep it at sea.
ANDHRA = (-2.0, -2.66)
OMAN = (-3.3, -31.7)


def at_sea() -> CycloneTrack:
    base = synthetic_track("ATSEA")
    points = [p.model_copy(update={"dist2land_km": 300.0}) for p in base.points]
    return base.model_copy(update={"points": points, "landfall": None})


def too_short() -> CycloneTrack:
    base = shifted(*ANDHRA, name="SHORT")
    points = [
        p if i in (6, 7) else p.model_copy(update={"max_wind_kt": None})
        for i, p in enumerate(base.points)
    ]
    return base.model_copy(update={"points": points})


def _run(track: CycloneTrack, **kw: object) -> RunResult:
    inputs = PipelineInputs(track=track, aoi="auto", surge_level_m=2.0, **kw)  # type: ignore[arg-type]
    result, _ = run_pipeline(inputs, SyntheticLayers(), "test-auto")
    return result


@pytest.fixture(scope="module")
def andhra() -> RunResult:
    return _run(shifted(*ANDHRA, name="HUDHUD", year=2014), run_validation=True)


def test_derived_aoi_is_centred_on_the_landfall_coast(andhra: RunResult) -> None:
    cov = andhra.summary.coverage
    assert cov is not None
    assert cov.aoi_source == "landfall"
    assert cov.landfall_coast == "Andhra Pradesh"
    minlon, minlat, maxlon, maxlat = andhra.hazard.layers[0].bbox
    lat, lon = andhra.summary.landfall_lat, andhra.summary.landfall_lon
    assert lat is not None and lon is not None
    assert minlon < lon < maxlon and minlat < lat < maxlat
    assert andhra.summary.population_at_risk > 0


def test_outside_odisha_no_shelter_is_borrowed_or_invented(andhra: RunResult) -> None:
    cov = andhra.summary.coverage
    assert cov is not None and cov.shelters == "none"
    assert "No shelter register" in cov.shelter_note
    assert andhra.assets.count == 0 and andhra.summary.shelters_total == 0
    assert andhra.decisions.assignments == [] and andhra.decisions.unassigned == []
    assert andhra.decisions.optimiser.status == "NOT_RUN"
    assert all(c.near is None and c.block is None for c in andhra.exposure.clusters)
    register_names = {s.name for s in load_register()}
    for action in andhra.decisions.actions:
        assert "Odisha" not in action.office
        assert not any(name in action.summary for name in register_names if len(name) > 4)
    subjects = {a.subject_id for a in andhra.decisions.actions}
    assert "watch-no-shelter-register" in subjects
    assert "warning-evacuate-flood-zone" in subjects
    assert andhra.provenance["shelters"] == "none: no shelter register for this region"


def test_trigger_zones_cover_the_whole_area_without_a_register(andhra: RunResult) -> None:
    assert [z.zone_name for z in andhra.parametric.zones] == ["Andhra Pradesh landfall coast"]


def test_unscorable_validation_says_why(andhra: RunResult) -> None:
    cov = andhra.summary.coverage
    assert cov is not None and cov.validation == "not_scorable"
    assert andhra.validation.available is False
    assert andhra.validation.reason_unavailable
    assert cov.validation_note == andhra.validation.reason_unavailable
    assert andhra.summary.csi is None


def test_pre_sentinel1_storm_is_never_scored() -> None:
    result = _run(shifted(*ANDHRA, name="OLD", year=2013), run_validation=True)
    assert result.validation.available is False
    assert "Before Sentinel-1" in (result.validation.reason_unavailable or "")


def test_briefings_state_no_shelter_figures_without_a_register(andhra: RunResult) -> None:
    advisories = build_advisories(andhra, AIClient(Settings(enable_ai=False)), ["en"])
    for a in advisories.advisories:
        assert a.generated_by == "TEMPLATE_FALLBACK"
        assert a.grounding.ok, a.grounding.ungrounded
        assert "No shelter register" in a.situation
        assert "shelter place" not in a.situation


def test_derived_aoi_in_odisha_uses_the_register() -> None:
    result = _run(synthetic_track("PURI"))
    cov = result.summary.coverage
    assert cov is not None and cov.shelters in {"register", "partial"}
    assert result.assets.count > 0
    names = {s.name for s in load_register()}
    assert all(s.name in names for s in result.assets.shelters)


@pytest.mark.parametrize(
    ("track", "error"),
    [
        (at_sea(), NoLandfallError),
        (shifted(*OMAN, name="FAR"), OutsideCoverageError),
        (too_short(), TrackTooShortError),
    ],
)
def test_unmodellable_tracks_are_refused_with_their_reason(
    track: CycloneTrack, error: type[Exception]
) -> None:
    with pytest.raises(error):
        check_modellable(track)


def test_stored_runs_get_coverage_derived(andhra: RunResult) -> None:
    legacy = andhra.model_copy(
        update={"summary": andhra.summary.model_copy(update={"coverage": None})}
    )
    cov = stored_coverage(legacy, "auto", run_validation=True)
    assert cov.shelters == "none" and cov.validation == "not_scorable"


# --- API: each failure is a problem+json slug, never a crash ----------------

TRACKS = {
    "ATSEA": at_sea(),
    "FAR": shifted(*OMAN, name="FAR"),
    "SHORT": too_short(),
}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    service = ScenarioService(
        store=RunStore(tmp_path / "runs"),
        layers_factory=SyntheticLayers,
        track_loader=lambda name, _season: TRACKS[name.upper()],
        ai=AIClient(Settings(enable_ai=False)),
    )
    app.dependency_overrides[get_scenario_service] = lambda: service
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("storm", "slug"),
    [("ATSEA", "no-landfall"), ("FAR", "outside-coverage"), ("SHORT", "track-too-short")],
)
def test_unmodellable_storm_is_a_422_problem(client: TestClient, storm: str, slug: str) -> None:
    res = client.post(
        "/api/v1/scenarios",
        json={
            "track": {"kind": "ibtracs", "storm_name": storm, "season": 2019},
            "aoi_preset": "auto",
        },
    )
    assert res.status_code == 422, res.text
    assert res.headers["content-type"].startswith("application/problem+json")
    body = res.json()
    assert body["type"] == f"https://prahari.dev/problems/{slug}"
    assert body["detail"]


@pytest.mark.parametrize("kind", ["gdacs", "bulletin"])
def test_unbuilt_track_kinds_are_400(client: TestClient, kind: str) -> None:
    res = client.post("/api/v1/scenarios", json={"track": {"kind": kind}, "aoi_preset": "auto"})
    assert res.status_code == 400
    assert res.json()["type"].endswith("/track-kind-unsupported")


def test_an_unnamed_cluster_is_located_not_named() -> None:
    from prahari.decision.packets import _place
    from prahari.models.results import PopulationCluster

    c = PopulationCluster(
        cluster_id="C001-002", block=None, near=None, lat=18.734, lon=84.401,
        people_at_risk=900, buildings_at_risk=10, area_flooded_km2=1.0, max_depth_m=1.2,
    )  # fmt: skip
    assert _place(None, None, c) == "at 18.73°N, 84.40°E"
    assert _place("PARTADA", "KAVITI", c) == "near PARTADA (Kaviti)"
    assert "None" not in _place(None, None, None)
