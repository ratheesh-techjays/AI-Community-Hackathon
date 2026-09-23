"""API contract tests (06-api-contracts.md §10) against synthetic layers."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prahari.ai.client import AIClient
from prahari.api.main import app
from prahari.api.service import ScenarioService, get_scenario_service
from prahari.config.settings import Settings, get_settings
from prahari.storage.runs import RunStore
from tests.synthetic import SyntheticLayers, track_loader

BODY = {
    "track": {"kind": "ibtracs", "storm_name": "FANI", "season": 2019},
    "aoi_preset": "puri_khordha",
    "hazard": {"surge_level_m": 2.0},
    "run_validation": True,
}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    service = ScenarioService(
        store=RunStore(tmp_path / "runs"),
        layers_factory=SyntheticLayers,
        track_loader=track_loader,
        ai=AIClient(Settings(enable_ai=False)),
    )
    app.dependency_overrides[get_scenario_service] = lambda: service
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _complete(client: TestClient, body: dict[str, object]) -> str:
    accepted = client.post("/api/v1/scenarios", json=body)
    assert accepted.status_code in (200, 202), accepted.text
    run_id = str(accepted.json()["run_id"])
    for _ in range(300):
        detail = client.get(f"/api/v1/scenarios/{run_id}").json()
        if detail["status"] in ("COMPLETE", "FAILED"):
            break
        time.sleep(0.1)
    assert detail["status"] == "COMPLETE", detail.get("error")
    return run_id


def test_scenario_round_trip_serves_every_result(client: TestClient) -> None:
    run_id = _complete(client, BODY)
    for part in ("hazard", "exposure", "assets", "decisions", "parametric", "validation"):
        res = client.get(f"/api/v1/scenarios/{run_id}/{part}")
        assert res.status_code == 200, part
    summary = client.get(f"/api/v1/scenarios/{run_id}").json()["summary"]
    assert summary["disclosure"]["limitations"]


def test_identical_request_is_a_cache_hit(client: TestClient) -> None:
    """C7 + C8: same body -> same hash; relabelling is still a cache hit."""
    run_id = _complete(client, BODY)
    again = client.post("/api/v1/scenarios", json={**BODY, "label": "renamed"})
    assert again.status_code == 200
    assert again.json()["cache_hit"] is True
    assert again.json()["run_id"] == run_id


def test_truthless_storm_validation_is_424(client: TestClient) -> None:
    """C9: never a fabricated score."""
    res = client.post(
        "/api/v1/scenarios",
        json={**BODY, "track": {"kind": "ibtracs", "storm_name": "MICHAUNG", "season": 2023}},
    )
    assert res.status_code == 424
    assert res.headers["content-type"].startswith("application/problem+json")
    assert res.json()["type"].endswith("/truth-unavailable")


def test_health_degrades_rather_than_errors_without_gemini(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C10."""
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    res = client.get("/api/v1/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "degraded"


def test_unknown_run_is_problem_json_404(client: TestClient) -> None:
    res = client.get("/api/v1/scenarios/does-not-exist/hazard")
    assert res.status_code == 404
    assert res.json()["type"].endswith("/run-not-found")


def test_unknown_aoi_is_a_422_field_error(client: TestClient) -> None:
    res = client.post("/api/v1/scenarios", json={**BODY, "aoi_preset": "atlantis"})
    assert res.status_code == 422
    assert any(e["field"].endswith("aoi_preset") for e in res.json()["errors"])


def test_unsupported_track_kind_is_400(client: TestClient) -> None:
    res = client.post("/api/v1/scenarios", json={**BODY, "track": {"kind": "gdacs"}})
    assert res.status_code == 400
    assert res.json()["type"].endswith("/invalid-track-source")


def test_writes_require_the_key_when_configured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "prahari_api_key", "s3cret")
    assert client.post("/api/v1/scenarios", json=BODY).status_code == 401
    ok = client.post("/api/v1/scenarios", json=BODY, headers={"X-Prahari-Key": "s3cret"})
    assert ok.status_code in (200, 202)


def test_writes_are_refused_outside_local_without_a_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "env", "prod")
    monkeypatch.setattr(get_settings(), "prahari_api_key", "")
    assert client.post("/api/v1/scenarios", json=BODY).status_code == 401


def test_layers_are_png_not_inlined_json(client: TestClient) -> None:
    """C12: rasters are served as images, never inlined in a JSON body."""
    run_id = _complete(client, BODY)
    hazard = client.get(f"/api/v1/scenarios/{run_id}/hazard").json()
    for layer in hazard["layers"]:
        res = client.get(layer["url"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content.startswith(b"\x89PNG")


def test_alias_resolves_to_the_run(client: TestClient) -> None:
    service = app.dependency_overrides[get_scenario_service]()
    meta = service.run_sync("FANI", 2019, "puri_khordha", True, alias="fani-2019-puri")
    res = client.get("/api/v1/scenarios/fani-2019-puri")
    assert res.status_code == 200
    assert res.json()["run_id"] == meta.run_id


def test_shelters_carry_real_blocks(client: TestClient) -> None:
    res = client.get("/api/v1/shelters", params={"district": "puri"})
    body = res.json()
    assert body["count"] == 177  # PURI rows in the committed register (README)
    assert all(s["register_id"].startswith("OSDMA-") for s in body["shelters"])


def test_query_unknown_run_is_404(client: TestClient) -> None:
    res = client.post("/api/v1/query", json={"question": "Which shelters?", "run_id": "nope"})
    assert res.status_code == 404


def test_query_is_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from prahari.api.routers import query as query_router

    run_id = _complete(client, BODY)
    monkeypatch.setattr(query_router, "_MAX_PER_WINDOW", 1)
    monkeypatch.setattr(query_router, "_recent", [])
    monkeypatch.setattr(query_router, "get_ai_client", lambda: AIClient(Settings(enable_ai=False)))
    first = client.post("/api/v1/query", json={"question": "Which shelters?", "run_id": run_id})
    assert first.status_code == 200
    assert first.json()["generated_by"] == "TEMPLATE_FALLBACK"
    second = client.post("/api/v1/query", json={"question": "Which shelters?", "run_id": run_id})
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "30"
