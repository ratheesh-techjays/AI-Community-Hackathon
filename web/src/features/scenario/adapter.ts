import type {
  ActionItem,
  AdvisoriesResponse,
  AssetsResponse,
  DecisionsResponse,
  ExposureResponse,
  HazardResponse,
  ModelDisclosure,
  ParametricResponse,
  ScenarioDetail,
  ShelterStatus,
  ValidationResponse,
} from "@/api/endpoints";
import type { DisclosureLimitations } from "@/components/DisclosureBadge";
import type { StageId, StageSpec } from "@/components/StageTimeline";

import type { Action, ScenarioData, ShelterRow } from "./types";

/**
 * API responses -> the shape screens render.
 *
 * No number is created here. Every figure is copied from an engine response;
 * this file only renames fields, joins ids to names, and attaches the
 * disclosure copy whose `notCaptured` list is the server's own limitations.
 */

export interface RunBundle {
  detail: ScenarioDetail;
  hazard: HazardResponse;
  exposure: ExposureResponse;
  assets: AssetsResponse;
  decisions: DecisionsResponse;
  parametric: ParametricResponse;
  validation: ValidationResponse;
  advisories: AdvisoriesResponse | null;
}

const STAGE_OF: Record<ActionItem["stage"], StageId> = {
  PRE_CYCLONE_WATCH: "watch",
  CYCLONE_ALERT: "alert",
  CYCLONE_WARNING: "warning",
  POST_LANDFALL: "postLandfall",
};

const STAGE_NAME: Record<StageId, string> = {
  watch: "Pre-Cyclone Watch",
  alert: "Cyclone Alert",
  warning: "Cyclone Warning",
  postLandfall: "Post-Landfall Outlook",
};

const NOMINAL_HOURS: Record<StageId, number> = { watch: 72, alert: 48, warning: 24, postLandfall: 12 };
const DEMO_STAGE: StageId = "alert";
const HOUR_MS = 3_600_000;
const MAP_LABELS = 10;

function limits(
  disclosure: ModelDisclosure,
  method: string,
  reason: string,
  model: string,
): DisclosureLimitations {
  return { method, reason, notCaptured: disclosure.limitations, model, provenanceHref: "/provenance" };
}

function toAction(item: ActionItem): Action {
  return {
    id: item.subject_id,
    kind: item.kind,
    title: item.title,
    owner: item.office,
    deadline: item.deadline,
    stage: STAGE_OF[item.stage],
    people: item.people,
    summary: item.summary,
    evidence: item.evidence.map((e) => ({ label: e.label, value: e.value, state: e.state })),
    related: item.related,
    focus:
      item.focus_lat != null && item.focus_lon != null
        ? { lat: item.focus_lat, lon: item.focus_lon, label: item.focus_label ?? "" }
        : null,
  };
}

function toShelter(s: ShelterStatus): ShelterRow {
  return {
    id: s.register_id,
    status: s.status,
    osdmaId: s.register_id,
    name: s.name,
    district: s.district,
    block: s.block ?? s.district,
    shelterType: s.shelter_type,
    capacity: s.capacity,
    capacityImputed: s.capacity_imputed,
    assignedPopulation: s.assigned_people,
    displacedPopulation: s.displaced_people ?? 0,
    depthM: s.depth_m ?? null,
    maxWindMs: s.max_wind_ms,
    reassignTo: s.reassign_to_name ? `${s.reassign_to_name} (${s.reassign_to ?? ""})` : null,
    reassignDistanceKm: s.reassign_distance_km ?? null,
    lat: s.lat,
    lon: s.lon,
  };
}

function stages(actions: Action[]): StageSpec[] {
  return (Object.keys(NOMINAL_HOURS) as StageId[]).map((id) => {
    const n = actions.filter((a) => a.stage === id).length;
    return {
      id,
      name: STAGE_NAME[id],
      nominalHours: NOMINAL_HOURS[id],
      // IMD's actual issue times are not ingested; the ruler shows the SOP windows.
      issuedAtHours: null,
      issueUnknown: true,
      packetStatus: n ? `${n} orders` : "No orders",
    };
  });
}

export function toScenarioData(b: RunBundle): ScenarioData {
  const { detail, hazard, exposure, assets, decisions, parametric, validation } = b;
  const summary = detail.summary;
  if (!summary) throw new Error(`run ${detail.run_id} has no summary`);

  const landfallIso = summary.landfall_at ?? hazard.landfall_at ?? detail.created_at;
  const nowIso = new Date(new Date(landfallIso).getTime() - NOMINAL_HOURS[DEMO_STAGE] * HOUR_MS).toISOString();
  const skill = validation.skill ?? null;
  const passed = Boolean(summary.disclosure.validated_against);
  const actions = decisions.actions.map(toAction);
  const shelters = assets.shelters.map(toShelter);
  const labelled = new Set(
    shelters
      .filter((s) => s.status === "compromised")
      .sort((a, b) => (b.depthM ?? 0) - (a.depthM ?? 0))
      .slice(0, MAP_LABELS)
      .map((s) => s.id),
  );

  const extentReason = skill
    ? passed
      ? `Scored against Sentinel-1 observed extent: CSI ${skill.csi.toFixed(2)}.`
      : `Scored against Sentinel-1 observed extent: CSI ${skill.csi.toFixed(3)}, below the 0.25 floor, so the extent stays heuristic.`
    : "No satellite truth was scored for this run.";

  return {
    meta: {
      runId: detail.alias ?? detail.run_id,
      storm: summary.storm_name.charAt(0) + summary.storm_name.slice(1).toLowerCase(),
      season: summary.season,
      area: summary.aoi,
      landfallIso,
      nowIso,
      nowHours: NOMINAL_HOURS[DEMO_STAGE],
      stage: DEMO_STAGE,
      stageName: STAGE_NAME[DEMO_STAGE],
      validated: passed,
      warnings: detail.warnings,
      provenance: detail.provenance ?? {},
    },
    stages: stages(actions),
    actions,
    shelters,
    unreached: decisions.unassigned.map((u) => ({
      id: u.population_cluster_id,
      status: "unreached" as const,
      near: u.near ? `Near ${u.near}` : u.population_cluster_id,
      block: u.block ?? "—",
      population: u.people,
      nearestShelter: u.nearest_infeasible_shelter ?? "—",
      distanceKm: u.nearest_distance_km ?? null,
      reason: u.why_infeasible,
    })),
    // Blocks with nothing at risk carry no information for an order; drop them.
    blocks: exposure.rows.filter((r) => r.population_at_risk > 0 || r.shelters_compromised > 0).map((r) => ({
      id: r.block,
      status: r.shelters_compromised > 0 ? ("compromised" as const) : r.population_at_risk > 0 ? ("watch" as const) : ("safe" as const),
      block: r.block,
      district: r.district ?? "—",
      populationAtRisk: r.population_at_risk,
      buildingsAtRisk: r.buildings_at_risk,
      areaFloodedKm2: r.area_flooded_km2,
      maxDepthM: r.max_depth_m,
      sheltersTotal: r.shelters_total,
      sheltersCompromised: r.shelters_compromised,
    })),
    zones: parametric.zones.map((z) => ({
      id: z.zone_id,
      status: z.triggered ? ("watch" as const) : ("safe" as const),
      zone: z.zone_name,
      windMs: z.trigger_a_wind.value,
      windTier: z.trigger_a_wind.threshold_hit ?? null,
      populationIndex: z.trigger_b_population_index.value,
      populationTier: z.trigger_b_population_index.threshold_hit ?? null,
      payoutCrore: z.payout_inr / 1e7,
    })),
    headline: {
      peakSurgeM: summary.peak_surge_m,
      maxWindMs: summary.max_wind_ms,
      areaFloodedKm2: summary.area_flooded_km2,
      naiveAreaKm2: hazard.inundation.naive_threshold_area_km2,
      populationAtRisk: summary.population_at_risk,
      buildingsAtRisk: summary.buildings_at_risk,
      sheltersTotal: summary.shelters_total,
      sheltersCompromised: summary.shelters_compromised,
      assignedPopulation: decisions.optimiser.assigned_people,
      unassignedPopulation: summary.unassigned_population,
      payoutCrore: summary.total_payout_inr / 1e7,
    },
    optimiser: {
      assigned: decisions.optimiser.assigned_people,
      greedyAssigned: decisions.optimiser.greedy_assigned_people,
      personKm: decisions.optimiser.total_person_km,
      greedyPersonKm: decisions.optimiser.greedy_person_km,
      solveMs: decisions.optimiser.solve_ms,
    },
    validation: skill
      ? {
          csi: skill.csi,
          pod: skill.pod,
          far: skill.far,
          bias: skill.bias,
          hits: skill.hits,
          misses: skill.misses,
          falseAlarms: skill.false_alarms,
          hitsKm2: skill.hits_km2,
          missesKm2: skill.misses_km2,
          falseAlarmsKm2: skill.false_alarms_km2,
          expectedRange: [skill.expected_range[0], skill.expected_range[1]] as const,
          truthSource: skill.truth_source,
          orbitPass: skill.orbit_pass,
          preDates: skill.pre_dates,
          postDates: skill.post_dates,
          crossCheck: validation.ems_crosscheck ?? null,
          surgeLevelUsedM: hazard.inundation.surge_level_m,
          demAsset: hazard.inundation.dem_asset,
          degenerate: skill.degenerate,
          suspicious: skill.suspicious,
          passed,
          failureAnalysis: skill.failure_analysis,
          sensitivity: validation.sensitivity.map((p) => ({
            surgeLevelM: p.surge_level_m,
            csi: p.csi,
            areaKm2: p.area_flooded_km2,
          })),
          layer: validation.layers[0] ?? null,
        }
      : null,
    validationUnavailableReason: validation.reason_unavailable ?? null,
    briefings: (b.advisories?.advisories ?? []).map((a) => ({
      stage: STAGE_OF[a.stage],
      language: a.language,
      headline: a.headline,
      situation: a.situation,
      caveats: a.caveats,
      generatedBy: a.generated_by,
      groundingOk: a.grounding.ok,
      numbersChecked: a.grounding.found.length,
      modelId: a.model_id ?? null,
      notice: a.notice ?? null,
    })),
    limitations: {
      surge: {
        ...limits(
          hazard.disclosure,
          "Holland (1980) parametric wind field, then an empirical surge index scaled by Bay of Bengal shelf geometry.",
          "No published Bay-of-Bengal wind-to-surge formula exists; this is an index, not a forecast.",
          "surge-index v1",
        ),
      },
      extent: limits(
        hazard.disclosure,
        `Connectivity-constrained bathtub on ${hazard.inundation.dem_asset}, flood-filled from the open sea; enclosed lagoons act as barriers.`,
        extentReason,
        "inundation v1",
      ),
      exposure: limits(
        exposure.disclosure,
        "Open Buildings v3 footprints and WorldPop 2019 population inside the modelled flood cells.",
        "Inherits the heuristic flood extent; rural footprint detection is incomplete.",
        "exposure v1",
      ),
      reachability: limits(
        decisions.disclosure,
        "OR-Tools min-cost flow from flood clusters to shelters outside the flood, within 10 km road distance (straight line x 1.3).",
        "Capacities are imputed from shelter type; no road network or road flooding is modelled.",
        "assignment v1",
      ),
      parametric: limits(
        parametric.disclosure,
        "Dual trigger per block zone: peak wind tier vs flooded-population share; pays the larger fraction of an illustrative limit.",
        "Thresholds and limits are illustrative of the mechanism, not actuarial.",
        "parametric v1",
      ),
    },
    map: {
      bbox: [hazard.layers[0]?.bbox[0] ?? 0, hazard.layers[0]?.bbox[1] ?? 0, hazard.layers[0]?.bbox[2] ?? 0, hazard.layers[0]?.bbox[3] ?? 0],
      flood: hazard.layers.find((l) => l.layer === "flood_depth") ?? null,
      wind: hazard.layers.find((l) => l.layer === "wind") ?? null,
      track: hazard.track.map((p) => ({ lat: p.lat, lon: p.lon })),
      shelters: shelters.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        status: s.status,
        labelled: labelled.has(s.id),
      })),
    },
  };
}
