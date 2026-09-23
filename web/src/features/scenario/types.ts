import type { LayerRef } from "@/api/endpoints";
import type { DisclosureLimitations, DisclosureState } from "@/components/DisclosureBadge";
import type { RowStatus, TableRow } from "@/components/DataTable";
import type { StageId, StageSpec } from "@/components/StageTimeline";

/**
 * Everything a screen needs to render one scenario run.
 *
 * Built by `toScenarioData` from the backend's /scenarios/{runId}/… responses.
 * Screens depend on THIS shape only; every number in it came from the engine.
 */

export interface ScenarioMeta {
  runId: string;
  storm: string;
  season: number;
  area: string;
  landfallIso: string;
  /** Demo clock: the run is read at the Cyclone Alert stage, T-48h. */
  nowIso: string;
  nowHours: number;
  stage: StageId;
  stageName: string;
  /** Extent scored against satellite truth AND cleared the CSI floor. */
  validated: boolean;
  warnings: string[];
  provenance: Record<string, string>;
}

export type ActionKind = "evacuate" | "reassign" | "staging" | "logistics" | "verify" | "finance";

export interface Evidence {
  label: string;
  value: string;
  state: DisclosureState;
}

export interface GeoFocus {
  lat: number;
  lon: number;
  label: string;
}

export interface Action {
  id: string;
  kind: ActionKind;
  title: string;
  /** Office that carries it out. Never a person's name. */
  owner: string;
  deadline: string;
  stage: StageId;
  people: number;
  summary: string;
  evidence: Evidence[];
  related: string[];
  focus: GeoFocus | null;
}

export interface ShelterRow extends TableRow {
  osdmaId: string;
  name: string;
  district: string;
  block: string;
  shelterType: string;
  capacity: number;
  capacityImputed: boolean;
  assignedPopulation: number;
  displacedPopulation: number;
  depthM: number | null;
  maxWindMs: number;
  reassignTo: string | null;
  reassignDistanceKm: number | null;
  lat: number;
  lon: number;
}

export interface UnreachedRow extends TableRow {
  /** Place named from the nearest register shelter — never invented. */
  near: string;
  block: string;
  population: number;
  nearestShelter: string;
  distanceKm: number | null;
  reason: string;
}

export interface BlockRow extends TableRow {
  block: string;
  district: string;
  populationAtRisk: number;
  buildingsAtRisk: number;
  areaFloodedKm2: number;
  maxDepthM: number;
  sheltersTotal: number;
  sheltersCompromised: number;
}

export interface ZoneRow extends TableRow {
  zone: string;
  windMs: number;
  windTier: string | null;
  populationIndex: number;
  populationTier: string | null;
  payoutCrore: number;
}

export interface ValidationData {
  csi: number;
  pod: number;
  far: number;
  bias: number;
  hits: number;
  misses: number;
  falseAlarms: number;
  hitsKm2: number;
  missesKm2: number;
  falseAlarmsKm2: number;
  expectedRange: readonly [number, number];
  truthSource: string;
  orbitPass: "ASCENDING" | "DESCENDING";
  preDates: string[];
  postDates: string[];
  crossCheck: string | null;
  surgeLevelUsedM: number;
  demAsset: string;
  /** CSI < 0.05: the masks barely overlap. */
  degenerate: boolean;
  /** CSI > 0.70: too good to be true. */
  suspicious: boolean;
  /** Cleared the floor: may carry the validated badge. */
  passed: boolean;
  failureAnalysis: string[];
  sensitivity: { surgeLevelM: number; csi: number; areaKm2: number }[];
  layer: LayerRef | null;
}

export interface BriefingData {
  stage: StageId;
  language: "en" | "or";
  headline: string;
  situation: string;
  caveats: string[];
  generatedBy: "GEMINI" | "GEMINI_REPAIRED" | "TEMPLATE_FALLBACK";
  groundingOk: boolean;
  numbersChecked: number;
  modelId: string | null;
  notice: string | null;
}

export interface MapShelter {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: RowStatus;
  /** Labelled on the map: the deepest compromised shelters only, to stay legible. */
  labelled: boolean;
}

export interface ScenarioData {
  meta: ScenarioMeta;
  stages: StageSpec[];
  actions: Action[];
  shelters: ShelterRow[];
  unreached: UnreachedRow[];
  blocks: BlockRow[];
  zones: ZoneRow[];
  headline: {
    peakSurgeM: number;
    maxWindMs: number;
    areaFloodedKm2: number;
    naiveAreaKm2: number;
    populationAtRisk: number;
    buildingsAtRisk: number;
    sheltersTotal: number;
    sheltersCompromised: number;
    assignedPopulation: number;
    unassignedPopulation: number;
    payoutCrore: number;
  };
  optimiser: {
    assigned: number;
    greedyAssigned: number;
    personKm: number;
    greedyPersonKm: number;
    solveMs: number;
  };
  validation: ValidationData | null;
  validationUnavailableReason: string | null;
  briefings: BriefingData[];
  limitations: Record<"surge" | "extent" | "exposure" | "reachability" | "parametric", DisclosureLimitations>;
  map: {
    bbox: readonly [number, number, number, number];
    flood: LayerRef | null;
    wind: LayerRef | null;
    track: { lat: number; lon: number }[];
    shelters: MapShelter[];
  };
}

/** A storm the selector can offer, whether or not a run exists for it yet. */
export interface StormOption {
  name: string;
  season: number;
  district: string;
  state: string;
  landfallLabel: string;
  hasSarTruth: boolean;
  hasEmsActivation: boolean;
  note: string;
  /** Run id when a precomputed scenario exists for this storm. */
  runId?: string;
  /** Backend AOI preset covering the landfall. Absent: no area is configured yet. */
  aoiPreset?: string;
}
