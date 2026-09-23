"""Scenario result models: the shapes behind /scenarios/{run_id}/... .

Every model that carries a modelled number carries a ModelDisclosure as a
required field (contract test C1). Literal fields are the honesty rules made
mechanical: C2 `model_class`, C3 `connectivity_enforced`, C4 `basis`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from prahari.models.disclosure import ModelDisclosure

ShelterState = Literal["compromised", "watch", "safe"]
Role = Literal[
    "DISTRICT_COLLECTOR", "BLOCK_DEV_OFFICER", "RELIEF_COMMISSIONER", "NDRF_STAGING", "FINANCE_DRF"
]
IMDStage = Literal["PRE_CYCLONE_WATCH", "CYCLONE_ALERT", "CYCLONE_WARNING", "POST_LANDFALL"]

# IMD's four warning stages, nominal lead times (IMD SOP, July 2024).
STAGE_HOURS: dict[IMDStage, float] = {
    "PRE_CYCLONE_WATCH": 72.0,
    "CYCLONE_ALERT": 48.0,
    "CYCLONE_WARNING": 24.0,
    "POST_LANDFALL": 12.0,
}


class LayerRef(BaseModel):
    """A class-indexed PNG served by /scenarios/{id}/layers/{layer}. Never inlined."""

    layer: str
    url: str
    bbox: tuple[float, float, float, float]
    width: int
    height: int
    classes: list[str]  # index -> class name; the client colours from tokens


class SurgeEstimateOut(BaseModel):
    peak_surge_m: float
    funnel_amplification: float
    coefficient: float
    model_class: Literal["heuristic_index"] = "heuristic_index"
    imd_forecast_surge_m: str | None = None
    limitations: list[str] = Field(min_length=1)
    calibration: None = None  # stays None until verified against IMD reports


class InundationOut(BaseModel):
    surge_level_m: float
    area_flooded_km2: float
    connectivity_enforced: Literal[True] = True
    dem_asset: str
    dem_vertical_error_m: float
    naive_threshold_area_km2: float  # what plain thresholding would have claimed


class TrackPointOut(BaseModel):
    iso_time: datetime
    lat: float
    lon: float
    max_wind_kt: float | None


class HazardResponse(BaseModel):
    storm: str
    track: list[TrackPointOut]
    landfall_at: datetime | None
    holland_b: float
    max_wind_ms: float
    surge: SurgeEstimateOut
    inundation: InundationOut
    layers: list[LayerRef]
    disclosure: ModelDisclosure


class ShelterStatus(BaseModel):
    register_id: str
    name: str
    district: str
    block: str | None
    locality: str | None
    shelter_type: str
    lat: float
    lon: float
    capacity: int
    capacity_imputed: bool
    depth_m: float | None  # None when the footprint is outside the flood
    max_wind_ms: float
    status: ShelterState
    assigned_people: int
    reassign_to: str | None = None  # register_id of the alternative
    reassign_to_name: str | None = None
    reassign_distance_km: float | None = None
    displaced_people: int = 0  # people whose nearest shelter this was


class PopulationCluster(BaseModel):
    cluster_id: str
    block: str | None
    near: str | None  # nearest register shelter name, for a human-readable place
    lat: float
    lon: float
    people_at_risk: int
    buildings_at_risk: int
    area_flooded_km2: float
    max_depth_m: float


class BlockExposure(BaseModel):
    block: str
    district: str | None
    population_at_risk: int
    buildings_at_risk: int
    area_flooded_km2: float
    max_depth_m: float
    shelters_total: int
    shelters_compromised: int


class ExposureResponse(BaseModel):
    rows: list[BlockExposure]
    totals: BlockExposure
    clusters: list[PopulationCluster]
    disclosure: ModelDisclosure


class AssetsResponse(BaseModel):
    shelters: list[ShelterStatus]
    count: int
    compromised: int
    disclosure: ModelDisclosure


class ShelterAssignment(BaseModel):
    population_cluster_id: str
    block: str | None
    people: int
    shelter_register_id: str
    shelter_name: str
    distance_km: float
    travel_time_min: float
    capacity_utilisation: float


class UnassignedCluster(BaseModel):
    population_cluster_id: str
    block: str | None
    near: str | None
    people: int
    reason: Literal["no_reachable_shelter", "capacity_exhausted", "all_shelters_compromised"]
    nearest_infeasible_shelter: str | None
    nearest_distance_km: float | None
    why_infeasible: str


class OptimiserReport(BaseModel):
    solver: Literal["ortools_min_cost_flow"] = "ortools_min_cost_flow"
    status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE"]
    arcs_considered: int
    arcs_filtered: int
    total_person_km: float
    greedy_person_km: float
    assigned_people: int
    greedy_assigned_people: int
    solve_ms: int


ActionKind = Literal["evacuate", "reassign", "staging", "logistics", "verify", "finance"]
EvidenceState = Literal["heuristic", "modelled", "validated"]


class Evidence(BaseModel):
    """One computed fact an action rests on, with the disclosure state it carries."""

    label: str
    value: str
    state: EvidenceState


class ActionItem(BaseModel):
    sequence: int
    subject_id: str  # stable id for the order ledger
    kind: ActionKind
    role: Role
    stage: IMDStage
    office: str  # who, in the words an official would use; never a person's name
    title: str  # the order, imperative, one line
    summary: str  # where and why
    people: int
    related: list[str]  # register ids / cluster ids this order touches
    focus_lat: float | None
    focus_lon: float | None
    focus_label: str | None
    deadline: datetime
    hours_before_landfall: float
    evidence: list[Evidence] = Field(min_length=1)


class DecisionsResponse(BaseModel):
    assignments: list[ShelterAssignment]
    unassigned: list[UnassignedCluster]
    optimiser: OptimiserReport
    actions: list[ActionItem]
    disclosure: ModelDisclosure


class TriggerDetail(BaseModel):
    metric: str
    value: float
    threshold_hit: str | None
    payout_fraction: float


class ZoneTrigger(BaseModel):
    zone_id: str
    zone_name: str
    trigger_a_wind: TriggerDetail
    trigger_b_population_index: TriggerDetail
    payout_inr: float  # max(A, B) of the zone limit -- the PCRIC pattern
    triggered: bool
    reference_agency: Literal["IMD_RSMC_NEW_DELHI"] = "IMD_RSMC_NEW_DELHI"
    basis: Literal["illustrative_not_actuarial"] = "illustrative_not_actuarial"


class ParametricResponse(BaseModel):
    zones: list[ZoneTrigger]
    total_payout_inr: float
    zone_limit_inr: float
    disclosure: ModelDisclosure


class HazardSkillOut(BaseModel):
    csi: float
    pod: float
    far: float
    bias: float
    hits: int
    misses: int
    false_alarms: int
    hits_km2: float
    misses_km2: float
    false_alarms_km2: float
    suspicious: bool
    degenerate: bool
    expected_range: tuple[float, float]
    truth_source: str
    orbit_pass: Literal["ASCENDING", "DESCENDING"]
    pre_dates: list[str]
    post_dates: list[str]
    failure_analysis: list[str] = Field(min_length=1)  # C6: never empty


class SensitivityPoint(BaseModel):
    surge_level_m: float
    csi: float
    area_flooded_km2: float


class ValidationResponse(BaseModel):
    available: bool
    storm: str
    aoi: str
    skill: HazardSkillOut | None
    sensitivity: list[SensitivityPoint]
    ems_crosscheck: str | None
    layers: list[LayerRef]
    reason_unavailable: str | None = None


class GroundingReport(BaseModel):
    ok: bool
    found: list[float]
    ungrounded: list[str]
    banned: list[str] = []  # claims the narrator must never make


class Advisory(BaseModel):
    """A stage briefing. `generated_by` is shown in the UI (04-ai-layer.md §4)."""

    role: Literal["DISTRICT_COLLECTOR"] = "DISTRICT_COLLECTOR"
    stage: IMDStage
    language: Literal["en", "or"]
    headline: str
    situation: str
    action_ids: list[str]  # subject_ids of this stage's deterministic actions
    caveats: list[str] = Field(min_length=1)  # injected, never generated
    generated_by: Literal["GEMINI", "GEMINI_REPAIRED", "TEMPLATE_FALLBACK"]
    grounding: GroundingReport
    model_id: str | None
    prompt_version: str
    notice: str | None = None


class AdvisoriesResponse(BaseModel):
    advisories: list[Advisory]


class RunSummary(BaseModel):
    storm_name: str
    season: int
    aoi: str
    landfall_at: datetime | None
    landfall_lat: float | None
    landfall_lon: float | None
    compressed_timeline: bool
    peak_surge_m: float
    max_wind_ms: float
    area_flooded_km2: float
    population_at_risk: int
    buildings_at_risk: int
    shelters_total: int
    shelters_compromised: int
    unassigned_population: int
    total_payout_inr: float
    csi: float | None
    disclosure: ModelDisclosure


class RunResult(BaseModel):
    """Everything one pipeline run produced. Persisted as run.json."""

    summary: RunSummary
    hazard: HazardResponse
    exposure: ExposureResponse
    assets: AssetsResponse
    decisions: DecisionsResponse
    parametric: ParametricResponse
    validation: ValidationResponse
    advisories: AdvisoriesResponse | None = None
    stage_timings_ms: dict[str, int]
    warnings: list[str]
    provenance: dict[str, str]
