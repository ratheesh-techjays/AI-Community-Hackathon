"""The scenario pipeline: track -> hazard -> exposure -> decision -> trigger -> validate.

One function, `run_pipeline`, used by both the API (background run) and the
CLI that precomputes demo runs:

    python -m prahari.workers.scenario --storm FANI --season 2019 \
        --aoi puri_khordha --validate --alias fani-2019-puri

All external data enters through a LayerSource, so tests run the whole
pipeline offline on synthetic layers.
"""

from __future__ import annotations

import argparse
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC
from typing import Literal

import numpy as np

from prahari.ai.advisories import build_advisories
from prahari.ai.client import AIClient
from prahari.api.errors import (
    HazardModelError,
    NoLandfallError,
    OutsideCoverageError,
    PrahariError,
    StormNotFoundError,
    TrackTooShortError,
)
from prahari.config import assets
from prahari.config.paths import IBTRACS_CSV
from prahari.config.regions import (
    AOI_PARAMS,
    AOI_PRESETS,
    AUTO_AOI,
    EMS_ACTIVATIONS,
    SAR_WINDOWS,
    AOIParams,
    coast_of,
    derive_aoi,
)
from prahari.decision.assignment import assign, not_run
from prahari.decision.packets import build_actions, mark_reassignments
from prahari.decision.parametric import ZONE_LIMIT_INR, zone_triggers
from prahari.evals import validation as val
from prahari.evals.metrics import CSI_FLOOR
from prahari.exposure.grid_exposure import (
    ShelterIndex,
    block_rollup,
    cell_centres,
    draft_clusters,
    finalise_clusters,
    shelter_states,
)
from prahari.hazard.grid import make_grid
from prahari.hazard.holland import KT_TO_MS, holland_b, track_max_wind_field
from prahari.hazard.inundation import (
    cell_area_km2,
    connected_inundation,
    naive_threshold,
    split_water,
)
from prahari.hazard.surge import DEFAULT_SURGE_MODEL, FUNNEL_AMPLIFICATION
from prahari.hazard.track import detect_landfall, peak_intensity, smooth_rmw
from prahari.ingestion.layers import (
    PERMANENT_WATER_OCCURRENCE,
    LayerSource,
    SarWindow,
)
from prahari.ingestion.shelters import in_bbox, load_register
from prahari.ingestion.tracks import catalogue, ibtracs
from prahari.models.disclosure import ModelDisclosure
from prahari.models.hazard import GridSpec
from prahari.models.results import (
    AssetsResponse,
    Coverage,
    DecisionsResponse,
    ExposureResponse,
    HazardResponse,
    InundationOut,
    LayerRef,
    ParametricResponse,
    PopulationCluster,
    RunResult,
    RunSummary,
    SurgeEstimateOut,
    TrackPointOut,
    ValidationResponse,
)
from prahari.models.track import CycloneTrack
from prahari.storage.png import encode_classes

GRID_RESOLUTION_DEG = 0.0025  # ~275 m at Puri
DEM_VERTICAL_ERROR_M = 4.0
TRACK_RADIUS_DEG = 6.0  # track points further than this cannot move wind in the AOI
ZONE_MAX_KM = 15.0  # cells further than this from any shelter get no block zone
REGISTER_NOTE = "OSDMA cyclone-shelter register (Odisha)"

# Class names are the design-token names (web/src/design/tokens/source.ts), so
# the browser colours each class from the theme, never from the backend.
LAYER_CLASSES: dict[str, list[str]] = {
    "flood_depth": ["none", "floodShallow", "floodModerate", "floodDeep"],
    "wind": ["none", "windLow", "windModerate", "windSevere", "windExtreme"],
    "validation": ["none", "agreement", "miss", "falseAlarm"],
}
FLOOD_BANDS_M = (0.5, 1.5)  # shallow < 0.5 <= moderate < 1.5 <= deep
# IMD categories in m/s: gale 62-87, storm 88-117, severe 118-221, extreme 222+ km/h.
WIND_BANDS_MS = (17.2, 24.4, 32.8, 61.7)


@dataclass(frozen=True)
class PipelineInputs:
    track: CycloneTrack
    aoi: str
    surge_level_m: float | None = None
    funnel_amplification: float | None = None
    holland_b_override: float | None = None
    dem_offset_m: float = 0.0
    run_validation: bool = False
    generate_advisories: bool = False
    languages: tuple[Literal["en", "or"], ...] = ("en",)
    resolution_deg: float = GRID_RESOLUTION_DEG


@dataclass
class Progress:
    on_stage: Callable[[str], None] = lambda _stage: None
    timings: dict[str, int] = field(default_factory=dict)
    _t: float = field(default_factory=time.perf_counter)

    def done(self, stage: str) -> None:
        now = time.perf_counter()
        self.timings[stage] = round((now - self._t) * 1000)
        self._t = now
        self.on_stage(stage)


def load_track(name: str, season: int | None) -> CycloneTrack:
    if not IBTRACS_CSV.exists():
        raise StormNotFoundError(f"IBTrACS not downloaded (expected at {IBTRACS_CSV}).")
    try:
        track = ibtracs.load_storm(IBTRACS_CSV, name, season)
    except ValueError as exc:
        raise StormNotFoundError(str(exc)) from exc
    points = smooth_rmw(track.points)
    return track.model_copy(update={"points": points, "landfall": detect_landfall(points)})


def _layer(run_id: str, name: str, grid: GridSpec) -> LayerRef:
    return LayerRef(
        layer=name,
        url=f"/api/v1/scenarios/{run_id}/layers/{name}",
        bbox=grid.bbox,
        width=grid.width,
        height=grid.height,
        classes=LAYER_CLASSES[name],
    )


def _depth_classes(depth: np.ndarray, flooded: np.ndarray) -> np.ndarray:
    out = np.zeros(depth.shape, dtype=np.uint8)
    out[flooded] = 1
    out[flooded & (depth >= FLOOD_BANDS_M[0])] = 2
    out[flooded & (depth >= FLOOD_BANDS_M[1])] = 3
    return out


def _wind_classes(wind: np.ndarray) -> np.ndarray:
    out = np.zeros(wind.shape, dtype=np.uint8)
    for i, threshold in enumerate(WIND_BANDS_MS, start=1):
        out[wind >= threshold] = i
    return out


_UNMODELLABLE: dict[str, type[PrahariError]] = {
    "no_landfall": NoLandfallError,
    "formed_over_land": NoLandfallError,
    "outside_coverage": OutsideCoverageError,
    "no_coast": OutsideCoverageError,
    "track_too_short": TrackTooShortError,
}


def check_modellable(track: CycloneTrack) -> None:
    """Raise the problem a landfall-derived AOI cannot get past, before any compute."""
    code, reason = catalogue.assess(track)
    if code is not None:
        raise _UNMODELLABLE[code](f"{track.name.title()} {track.season}: {reason}")


@dataclass(frozen=True)
class ResolvedAOI:
    bbox: tuple[float, float, float, float]
    params: AOIParams
    source: Literal["preset", "landfall"]
    coast: str | None


def resolve_aoi(key: str, track: CycloneTrack) -> ResolvedAOI:
    if key in AOI_PRESETS:
        return ResolvedAOI(AOI_PRESETS[key], AOI_PARAMS[key], "preset", AOI_PARAMS[key].state)
    if key != AUTO_AOI:
        raise HazardModelError(f"unknown AOI {key!r}")
    check_modellable(track)
    landfall = track.landfall or detect_landfall(track.points)
    coast = coast_of(landfall.lat, landfall.lon) if landfall else None
    if landfall is None or coast is None:  # check_modellable already refused these
        raise OutsideCoverageError(f"{track.name.title()}: no configured landfall coast")
    params = AOIParams(
        label=f"{coast.name} landfall coast",
        district_label="",
        funnel_key=coast.funnel_key,
        state=coast.name,
        country=coast.country,
    )
    return ResolvedAOI(derive_aoi(landfall.lat, landfall.lon), params, "landfall", coast.name)


def relief_office(aoi: AOIParams) -> str:
    """The office that owns relief logistics, named by role, never a person."""
    if aoi.state == "Odisha":
        return "Special Relief Commissioner, Odisha"
    if aoi.country == "India":
        return f"State relief commissioner, {aoi.state}"
    return f"National disaster management office, {aoi.country}"


def run_pipeline(
    inputs: PipelineInputs,
    layers: LayerSource,
    run_id: str,
    on_stage: Callable[[str], None] = lambda _s: None,
    ai: AIClient | None = None,
) -> tuple[RunResult, dict[str, bytes]]:
    progress = Progress(on_stage=on_stage)
    warnings: list[str] = []
    track = inputs.track
    resolved = resolve_aoi(inputs.aoi, track)
    bbox, aoi = resolved.bbox, resolved.params
    grid = make_grid(bbox, inputs.resolution_deg)
    lats, lons = cell_centres(grid)
    cell_km2 = cell_area_km2(grid.bbox, grid.width, grid.height)

    # --- L2 wind -----------------------------------------------------------
    mid_lat, mid_lon = (bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2
    positions = [
        {
            "lat": p.lat,
            "lon": p.lon,
            "vmax_kt": p.max_wind_kt,
            "rmw_nmi": p.rmw_nmi,
            "pressure_mb": p.central_pressure_mb,
            "env_pressure_mb": p.env_pressure_mb or 1010.0,
        }
        for p in track.points
        if p.max_wind_kt
        and p.central_pressure_mb
        and p.rmw_nmi
        and abs(p.lat - mid_lat) <= TRACK_RADIUS_DEG
        and abs(p.lon - mid_lon) <= TRACK_RADIUS_DEG
    ]
    if not positions:
        raise HazardModelError("no usable track positions near the AOI")
    imputed = sum(p.rmw_imputed for p in track.points)
    if imputed:
        warnings.append(
            f"RMW_IMPUTED: {imputed} of {len(track.points)} track points smoothed or filled"
        )
    wind = track_max_wind_field(lats, lons, positions)
    landfall = track.landfall
    ref = next(
        (p for p in track.points if landfall and p.iso_time == landfall.iso_time),
        peak_intensity(track),
    )
    ref_vmax_kt = ref.max_wind_kt or 0.0
    b = inputs.holland_b_override or holland_b(
        ref_vmax_kt * KT_TO_MS,
        max(((ref.env_pressure_mb or 1010.0) - (ref.central_pressure_mb or 1010.0)) * 100, 0),
    )
    progress.done("hazard.wind_field")

    # --- L2 surge + inundation --------------------------------------------
    funnel = inputs.funnel_amplification or FUNNEL_AMPLIFICATION[aoi.funnel_key]
    surge = DEFAULT_SURGE_MODEL.estimate(ref_vmax_kt, funnel)
    level = inputs.surge_level_m if inputs.surge_level_m is not None else surge.peak_surge_m
    dem = layers.dem(grid) + inputs.dem_offset_m
    occurrence = layers.water_occurrence(grid)
    ocean, lagoons = split_water(dem, occurrence)
    permanent = occurrence >= PERMANENT_WATER_OCCURRENCE
    land = ~ocean & ~permanent & ~lagoons
    if not ocean.any():
        raise HazardModelError("no open-sea cells in the AOI; inundation cannot be seeded")
    if lagoons.any():
        warnings.append(
            f"LAGOON_BARRIER: {int(lagoons.sum())} enclosed-lagoon cells neither seed "
            "nor carry surge"
        )
    # Lagoons are barriers: surge cannot travel across them in a static model.
    dem_flood = np.where(lagoons, np.inf, dem)

    def predict(surge_level: float) -> np.ndarray:
        return np.asarray(connected_inundation(dem_flood, surge_level, ocean) & land, dtype=bool)

    flooded = predict(level)
    depth = np.where(flooded, level - dem, 0.0)
    naive = naive_threshold(dem, level) & land
    progress.done("hazard.inundation")

    # --- L3 exposure --------------------------------------------------------
    population = layers.population(grid)
    # A register row with no block is zoned under its district, never dropped.
    shelters_in = [
        s if s.block else s.model_copy(update={"block": s.district})
        for s in in_bbox(load_register(), bbox)
    ]
    # Outside Odisha there is no register: no shelter is ever borrowed or invented.
    index = ShelterIndex(shelters_in, mid_lat) if shelters_in else None
    if index is None:
        warnings.append("NO_SHELTER_REGISTER: no shelter register covers this area")
    drafts = draft_clusters(grid, flooded, depth, population)
    counts = layers.building_counts([d.zone for d in drafts])
    # Preset AOIs keep their stored behaviour; a derived AOI names a cluster
    # only from a register shelter within the zone radius.
    reach = ZONE_MAX_KM if resolved.source == "landfall" else None
    clusters = finalise_clusters(drafts, counts, index, cell_km2, reach)
    shelter_rows = shelter_states(grid, shelters_in, flooded, depth, wind)
    progress.done("exposure")

    # --- L4 decision ------------------------------------------------------------
    if index is not None:
        result = assign(clusters, shelter_rows, index)
        mark_reassignments(shelter_rows, clusters, result, index)
    else:
        result = not_run()
    unzoned = aoi.label if index is None else f"Outside register blocks ({aoi.state})"
    rows, totals = block_rollup(clusters, shelter_rows, unzoned)
    progress.done("decision.assignment")

    # --- L5 parametric -----------------------------------------------------------
    block_names = sorted({s.block for s in shelters_in if s.block})
    if index is not None:
        near_idx, near_km = index.nearest(lats, lons)
        block_ids = {name: i for i, name in enumerate(block_names)}
        block_of_cell = np.vectorize(lambda i: block_ids[shelters_in[i].block or ""])(near_idx)
        in_reach = near_km <= ZONE_MAX_KM
        block_of_cell = np.where(in_reach & ~ocean, block_of_cell, -1).astype(int)
        if resolved.source == "landfall" and (~in_reach & land).any():
            # Land beyond every register block is its own zone, not dropped.
            block_names = [*block_names, unzoned]
            block_of_cell = np.where(~in_reach & land, len(block_names) - 1, block_of_cell)
    else:
        # No register blocks: the whole land area is one zone.
        block_names = [unzoned]
        block_of_cell = np.where(land, 0, -1).astype(int)
    zones = zone_triggers(block_of_cell, block_names, wind, population, flooded)
    landfall_at = (landfall.iso_time if landfall else ref.iso_time).replace(tzinfo=UTC)
    actions = build_actions(
        landfall_at,
        aoi.district_label,
        shelter_rows,
        result,
        zones,
        clusters,
        relief_office=relief_office(aoi),
        area_label=aoi.label,
        has_register=index is not None,
    )
    progress.done("decision.parametric_and_packets")

    # --- L6 validation -------------------------------------------------------
    layer_png = {
        "flood_depth": encode_classes(_depth_classes(depth, flooded)),
        "wind": encode_classes(_wind_classes(wind)),
    }
    hazard_disclosure = ModelDisclosure.surge()
    pinned = SAR_WINDOWS.get((track.name.upper(), track.season))
    window: SarWindow | None = SarWindow(**pinned.model_dump()) if pinned else None
    unavailable_reason = "Validation was not requested for this run."
    if inputs.run_validation and window is None:
        # No pinned pair: search for one, or say exactly why none can exist.
        if landfall is None:
            unavailable_reason = "No landfall, so there is no flood to score."
        elif landfall.iso_time.date() < catalogue.SENTINEL1_START:
            unavailable_reason = (
                "Before Sentinel-1 (October 2014): no radar imagery to score against."
            )
        else:
            window, unavailable_reason = layers.find_sar_window(grid, landfall.iso_time)
    validation: ValidationResponse | None = None
    if inputs.run_validation and window is not None:
        truth = layers.sar_truth(grid, window)
        skill, cmap = val.score(
            flooded,
            truth,
            land,
            cell_km2,
            block_of_cell,
            block_names,
            landfall_at,
            DEM_VERTICAL_ERROR_M,
        )
        progress.done("validation.sar")
        scorable = skill.hits + skill.misses + skill.false_alarms
        if scorable == 0:
            # Neither mask has flood where the pass saw land: there is nothing
            # to score, and a CSI of 0 would be a fabricated number.
            covered = int((truth.valid & land).sum())
            unavailable_reason = (
                f"Nothing to score: the {truth.orbit_pass.lower()} pass covered {covered} land "
                f"cells of the modelled area and neither the model nor Sentinel-1 shows flood "
                f"in them ({', '.join(truth.pre_dates)} vs {', '.join(truth.post_dates)})."
            )
            warnings.append("VALIDATION_UNSCORABLE: no flood in either mask inside the SAR swath")
        else:
            levels = sorted({max(round(level + d, 2), 0.1) for d in (-1.0, -0.5, 0.0, 0.5, 1.0)})
            validation = ValidationResponse(
                available=True,
                storm=f"{track.name.title()} {track.season}",
                aoi=aoi.label,
                skill=skill,
                sensitivity=val.sensitivity(levels, predict, truth, land, cell_km2),
                ems_crosscheck=EMS_ACTIVATIONS.get(track.name.upper()),
                layers=[_layer(run_id, "validation", grid)],
            )
            layer_png["validation"] = encode_classes(cmap)
            passed = skill.csi >= CSI_FLOOR and not skill.suspicious and not skill.degenerate
            hazard_disclosure = hazard_disclosure.with_skill(
                f"sentinel1_{truth.orbit_pass.lower()}_{track.name.lower()}_{track.season}"
                if passed
                else None,
                {"csi": skill.csi, "pod": skill.pod, "far": skill.far},
            )
            if not passed:
                warnings.append(
                    f"VALIDATION_BELOW_FLOOR: CSI {skill.csi:.3f} < {CSI_FLOOR}; extent stays "
                    "'heuristic', never 'validated'"
                )
    if validation is None:
        validation = ValidationResponse(
            available=False,
            storm=f"{track.name.title()} {track.season}",
            aoi=aoi.label,
            skill=None,
            sensitivity=[],
            ems_crosscheck=None,
            layers=[],
            reason_unavailable=unavailable_reason,
        )

    exposure_disclosure = ModelDisclosure.exposure()
    hazard = HazardResponse(
        storm=track.name,
        track=[
            TrackPointOut(
                iso_time=p.iso_time.replace(tzinfo=UTC),
                lat=p.lat,
                lon=p.lon,
                max_wind_kt=p.max_wind_kt,
            )
            for p in track.points
        ],
        landfall_at=landfall_at if landfall else None,
        holland_b=round(b, 3),
        max_wind_ms=round(float(wind.max()), 1),
        surge=SurgeEstimateOut(
            peak_surge_m=surge.peak_surge_m,
            funnel_amplification=surge.funnel_amplification,
            coefficient=surge.coefficient,
            imd_forecast_surge_m=surge.imd_forecast_surge_m,
            limitations=hazard_disclosure.limitations,
        ),
        inundation=InundationOut(
            surge_level_m=round(level, 2),
            area_flooded_km2=round(float(flooded.sum()) * cell_km2, 1),
            dem_asset=assets.DEM_COPERNICUS,
            dem_vertical_error_m=DEM_VERTICAL_ERROR_M,
            naive_threshold_area_km2=round(float(naive.sum()) * cell_km2, 1),
        ),
        layers=[_layer(run_id, "flood_depth", grid), _layer(run_id, "wind", grid)],
        disclosure=hazard_disclosure,
    )
    compromised = sum(s.status == "compromised" for s in shelter_rows)
    unassigned = sum(u.people for u in result.unassigned)
    total_payout = float(sum(z.payout_inr for z in zones))
    stages_hours = (
        (landfall.iso_time - track.points[0].iso_time).total_seconds() / 3600 if landfall else None
    )
    summary = RunSummary(
        storm_name=track.name,
        season=track.season,
        aoi=aoi.label,
        landfall_at=hazard.landfall_at,
        landfall_lat=landfall.lat if landfall else None,
        landfall_lon=landfall.lon if landfall else None,
        # Genesis-to-landfall under 72 h means IMD could not run all four stages.
        compressed_timeline=stages_hours is not None and stages_hours < 72,
        peak_surge_m=round(level, 2),
        max_wind_ms=hazard.max_wind_ms,
        area_flooded_km2=hazard.inundation.area_flooded_km2,
        population_at_risk=totals.population_at_risk,
        buildings_at_risk=totals.buildings_at_risk,
        shelters_total=len(shelter_rows),
        shelters_compromised=compromised,
        unassigned_population=unassigned,
        total_payout_inr=total_payout,
        csi=validation.skill.csi if validation.skill else None,
        disclosure=hazard_disclosure,
        coverage=Coverage(
            aoi_source=resolved.source,
            landfall_coast=resolved.coast,
            **_shelter_coverage(index is not None, clusters),
            validation=(
                "scored"
                if validation.available
                else "not_scorable"
                if inputs.run_validation
                else "not_requested"
            ),
            validation_note=None if validation.available else validation.reason_unavailable,
        ),
    )
    run = RunResult(
        summary=summary,
        hazard=hazard,
        exposure=ExposureResponse(
            rows=rows, totals=totals, clusters=clusters, disclosure=exposure_disclosure
        ),
        assets=AssetsResponse(
            shelters=sorted(
                shelter_rows, key=lambda s: (s.status != "compromised", s.status != "watch", s.name)
            ),
            count=len(shelter_rows),
            compromised=compromised,
            disclosure=exposure_disclosure,
        ),
        decisions=DecisionsResponse(
            assignments=result.assignments,
            unassigned=result.unassigned,
            optimiser=result.report,
            actions=actions,
            disclosure=ModelDisclosure.decision(),
        ),
        parametric=ParametricResponse(
            zones=zones,
            total_payout_inr=total_payout,
            zone_limit_inr=ZONE_LIMIT_INR,
            disclosure=ModelDisclosure.parametric(),
        ),
        validation=validation,
        stage_timings_ms=progress.timings,
        warnings=warnings,
        provenance={
            "track": track.provenance.source_id,
            "dem": assets.DEM_COPERNICUS,
            "surface_water": assets.SURFACE_WATER,
            "population": f"{assets.POPULATION_WORLDPOP} (2019)",
            "buildings": assets.BUILDINGS_OPEN_BUILDINGS,
            "shelters": (
                "osdma.shelters (data/raw/osdma_shelters.csv)"
                if index is not None
                else "none: no shelter register for this region"
            ),
            "sar_truth": assets.SENTINEL1_GRD if validation.available else "not used",
        },
    )
    if inputs.generate_advisories:
        # Gemini narrates computed results; every number is re-validated
        # against engine output. No AI client means templates throughout.
        run.advisories = build_advisories(run, ai or AIClient(), list(inputs.languages))
        progress.done("ai.advisories")
        run.stage_timings_ms = progress.timings
        if {a.generated_by for a in run.advisories.advisories} == {"TEMPLATE_FALLBACK"}:
            run.warnings.append("AI_TEMPLATE_ONLY: every advisory used the deterministic template")
    return run, layer_png


def _shelter_coverage(has_register: bool, clusters: list[PopulationCluster]) -> dict[str, str]:
    if not has_register:
        return {
            "shelters": "none",
            "shelter_note": (
                "No shelter register for this region. PRAHARI holds the OSDMA register for "
                "Odisha only, so shelter checks and assignment are skipped here."
            ),
        }
    far = sum(c.block is None for c in clusters)
    if far:
        return {
            "shelters": "partial",
            "shelter_note": (
                f"The {REGISTER_NOTE} covers only part of this area: {far} of {len(clusters)} "
                f"flood clusters are more than {ZONE_MAX_KM:g} km from a register shelter."
            ),
        }
    return {"shelters": "register", "shelter_note": REGISTER_NOTE}


def stored_coverage(result: RunResult, aoi_preset: str, run_validation: bool) -> Coverage:
    """Coverage for a run stored before the field existed, from what it holds."""
    validation = result.validation
    return Coverage(
        aoi_source="landfall" if aoi_preset == AUTO_AOI else "preset",
        landfall_coast=AOI_PARAMS[aoi_preset].state if aoi_preset in AOI_PARAMS else None,
        **_shelter_coverage(result.summary.shelters_total > 0, result.exposure.clusters),
        validation=(
            "scored"
            if validation.available
            else "not_scorable"
            if run_validation
            else "not_requested"
        ),
        validation_note=None if validation.available else validation.reason_unavailable,
    )


def main() -> None:
    from prahari.api.service import ScenarioService

    parser = argparse.ArgumentParser(description="Run and store a PRAHARI scenario.")
    parser.add_argument("--storm", required=True)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--aoi", default="puri_khordha")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--alias")
    args = parser.parse_args()

    service = ScenarioService()
    meta = service.run_sync(args.storm, args.season, args.aoi, args.validate, alias=args.alias)
    result = service.store.result(meta.run_id)
    print(f"run {meta.run_id} {meta.status} alias={meta.alias}")
    if result:
        print(result.summary.model_dump_json(indent=2, exclude={"disclosure"}))
        print("timings", result.stage_timings_ms)


if __name__ == "__main__":
    main()
