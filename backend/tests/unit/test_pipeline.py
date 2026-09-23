"""End-to-end pipeline invariants on synthetic layers (no network)."""

from __future__ import annotations

import struct
import zlib

import numpy as np
import pytest

from prahari.hazard.inundation import split_water
from prahari.ingestion.shelters import CAPACITY_BY_TYPE, load_register
from prahari.models.results import RunResult
from prahari.storage.png import encode_classes
from prahari.workers.scenario import PipelineInputs, run_pipeline
from tests.synthetic import SyntheticLayers, coastal_dem, synthetic_track


@pytest.fixture(scope="module")
def run() -> tuple[RunResult, dict[str, bytes]]:
    inputs = PipelineInputs(
        track=synthetic_track(), aoi="puri_khordha", surge_level_m=2.0, run_validation=True
    )
    return run_pipeline(inputs, SyntheticLayers(), "test-run")


def test_pipeline_produces_every_stage(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, layers = run
    assert set(result.stage_timings_ms) >= {
        "hazard.wind_field",
        "hazard.inundation",
        "exposure",
        "decision.assignment",
        "validation.sar",
    }
    assert set(layers) == {"flood_depth", "wind", "validation"}
    assert result.summary.area_flooded_km2 > 0
    assert result.summary.population_at_risk == sum(
        c.people_at_risk for c in result.exposure.clusters
    )


def test_every_modelled_payload_carries_disclosure(run: tuple[RunResult, dict[str, bytes]]) -> None:
    """C1: disclosure is present and non-empty wherever a modelled number is."""
    result, _ = run
    for d in (
        result.summary.disclosure,
        result.hazard.disclosure,
        result.exposure.disclosure,
        result.assets.disclosure,
        result.decisions.disclosure,
        result.parametric.disclosure,
    ):
        assert d.limitations


def test_honesty_literals(run: tuple[RunResult, dict[str, bytes]]) -> None:
    """C2, C3, C4, C6."""
    result, _ = run
    assert result.hazard.surge.model_class == "heuristic_index"
    assert result.hazard.surge.calibration is None
    assert result.hazard.inundation.connectivity_enforced is True
    assert all(z.basis == "illustrative_not_actuarial" for z in result.parametric.zones)
    assert result.validation.skill is not None
    assert result.validation.skill.failure_analysis


def test_connectivity_never_exceeds_naive(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    inundation = result.hazard.inundation
    assert inundation.area_flooded_km2 <= inundation.naive_threshold_area_km2


def test_no_one_is_sent_to_a_compromised_shelter(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    compromised = {s.register_id for s in result.assets.shelters if s.status == "compromised"}
    assert compromised, "synthetic surge should compromise some coastal shelters"
    assert not {a.shelter_register_id for a in result.decisions.assignments} & compromised


def test_assignments_respect_capacity(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    capacity = {s.register_id: s.capacity for s in result.assets.shelters}
    load: dict[str, int] = {}
    for a in result.decisions.assignments:
        load[a.shelter_register_id] = load.get(a.shelter_register_id, 0) + a.people
    assert all(load[k] <= capacity[k] for k in load)


def test_people_are_conserved(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    d = result.decisions
    assigned = sum(a.people for a in d.assignments)
    unassigned = sum(u.people for u in d.unassigned)
    assert assigned + unassigned == result.summary.population_at_risk
    assert d.optimiser.assigned_people == assigned


def test_optimiser_is_no_worse_than_greedy(run: tuple[RunResult, dict[str, bytes]]) -> None:
    report = run[0].decisions.optimiser
    assert report.status == "OPTIMAL"
    assert report.assigned_people >= report.greedy_assigned_people
    if report.assigned_people == report.greedy_assigned_people:
        assert report.total_person_km <= report.greedy_person_km + 1e-6


def test_every_unassigned_cluster_explains_itself(run: tuple[RunResult, dict[str, bytes]]) -> None:
    for u in run[0].decisions.unassigned:
        assert u.reason in {
            "no_reachable_shelter",
            "capacity_exhausted",
            "all_shelters_compromised",
        }
        assert u.why_infeasible


def test_actions_are_grounded_and_ordered(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    actions = result.decisions.actions
    assert actions
    assert all(a.evidence for a in actions)
    assert len({a.subject_id for a in actions}) == len(actions)
    landfall = result.summary.landfall_at
    assert landfall is not None
    assert all(a.deadline < landfall for a in actions)


def test_payout_is_the_larger_trigger(run: tuple[RunResult, dict[str, bytes]]) -> None:
    result, _ = run
    limit = result.parametric.zone_limit_inr
    for z in result.parametric.zones:
        frac = max(z.trigger_a_wind.payout_fraction, z.trigger_b_population_index.payout_fraction)
        assert z.payout_inr == pytest.approx(limit * frac)


def test_synthetic_skill_is_high_but_not_suspiciously_perfect(
    run: tuple[RunResult, dict[str, bytes]],
) -> None:
    skill = run[0].validation.skill
    assert skill is not None
    assert 0.5 < skill.csi < 1.0


def test_shelter_names_come_from_the_register(run: tuple[RunResult, dict[str, bytes]]) -> None:
    register = {s.register_id: s.name for s in load_register()}
    for s in run[0].assets.shelters:
        assert register[s.register_id] == s.name


def test_lagoon_behind_a_narrow_inlet_is_not_sea() -> None:
    from prahari.hazard.grid import make_grid

    grid = make_grid((85.3, 19.6, 86.4, 20.4), 0.0025)
    dem = coastal_dem(grid)
    sea, lagoons = split_water(dem, np.where(dem <= 0, 100.0, 0.0))
    r0, c0 = int(grid.height * 0.80), int(grid.width * 0.30)
    assert lagoons[r0 + 2, c0 + 2]
    assert not sea[r0 + 2, c0 + 2]
    assert not (sea & lagoons).any()


def test_register_uses_the_real_block_column() -> None:
    records = load_register()
    assert len(records) == 877
    assert len({r.register_id for r in records}) == 877
    puri_blocks = {r.block for r in records if r.district == "PURI"}
    assert "ASTARANGA" in puri_blocks
    assert "BRAHMAGIRI" in puri_blocks  # BRAMHAGIRI canonicalised
    assert all(r.capacity == CAPACITY_BY_TYPE.get(r.shelter_type, 0) for r in records)


def test_png_round_trips() -> None:
    classes = np.array([[0, 1, 2], [3, 2, 1]], dtype=np.uint8)
    png = encode_classes(classes)
    assert png.startswith(b"\x89PNG")
    idat = png.index(b"IDAT")
    (length,) = struct.unpack(">I", png[idat - 4 : idat])
    raw = zlib.decompress(png[idat + 4 : idat + 4 + length])
    rows = [raw[i * 4 + 1 : i * 4 + 4] for i in range(2)]
    assert rows == [bytes([0, 1, 2]), bytes([3, 2, 1])]


def test_nothing_to_score_is_unavailable_not_a_zero_csi() -> None:
    """A pass that sees no flood where the model has none cannot yield CSI 0."""

    class NoOverlap(SyntheticLayers):
        def sar_truth(self, grid, window):  # type: ignore[no-untyped-def]
            t = super().sar_truth(grid, window)
            return t.__class__(
                flooded_fraction=np.zeros_like(t.flooded_fraction),
                valid=np.zeros_like(t.valid),
                pre_dates=t.pre_dates,
                post_dates=t.post_dates,
                orbit_pass=t.orbit_pass,
                truth_source=t.truth_source,
            )

    inputs = PipelineInputs(
        track=synthetic_track(), aoi="puri_khordha", surge_level_m=2.0, run_validation=True
    )
    result, layers = run_pipeline(inputs, NoOverlap(), "no-overlap")
    assert result.validation.available is False
    assert result.validation.skill is None
    assert result.summary.csi is None
    assert "Nothing to score" in (result.validation.reason_unavailable or "")
    assert "validation" not in layers
