import type { StageSpec, StageId } from "@/components/StageTimeline";
import type { Action } from "@/features/fixtures/actions";
import type {
  BlockRow,
  FailureRow,
  ShelterRow,
  UnreachedRow,
} from "@/features/fixtures/fani";

/**
 * Everything a screen needs to render one scenario run.
 *
 * This is the frontend's view of a completed `ScenarioRun`. Today it is built
 * from fixtures; tomorrow each field maps to one backend endpoint under
 * /scenarios/{runId}/… (see docs/design/06-api-contracts.md). Screens depend
 * on THIS shape only, so the swap does not touch them.
 */

export interface ScenarioMeta {
  runId: string;
  storm: string;
  season: number;
  district: string;
  state: string;
  landfallIso: string;
  nowIso: string;
  nowHours: number;
  stage: StageId;
  stageName: string;
  /** Precomputed on the backend's hot tier; safe to demo offline. */
  precomputed: boolean;
  /** Extent has been scored against satellite truth for this run. */
  validated: boolean;
  /** Fixture data, not live model output. Shown in the UI. */
  isFixture: boolean;
}

export interface ScenarioData {
  meta: ScenarioMeta;
  stages: StageSpec[];
  actions: Action[];
  shelters: ShelterRow[];
  shelterSummary: { inDistrict: number; compromised: number };
  unreached: UnreachedRow[];
  headline: {
    peakSurgeM: number;
    areaFloodedKm2: number;
    populationAtRisk: number;
    buildingsAtRisk: number;
    hospitalsAtRisk: number;
    roadKmAffected: number;
    sheltersCompromised: number;
  };
  blocks: BlockRow[];
  validation: {
    csi: number;
    pod: number;
    far: number;
    bias: number;
    hits: number;
    misses: number;
    falseAlarms: number;
    expectedRange: readonly [number, number];
    truthSource: string;
    orbitPass: "ASCENDING" | "DESCENDING";
    preWindow: string;
    postWindow: string;
    crossCheck: string;
    surgeLevelUsedM: number;
    imdForecastSurgeM: string;
    demAsset: string;
  } | null;
  failures: FailureRow[];
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
}
