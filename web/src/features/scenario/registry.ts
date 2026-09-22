import type { StageSpec } from "@/components/StageTimeline";
import { ACTIONS } from "@/features/fixtures/actions";
import {
  BLOCKS,
  FAILURES,
  HEADLINE,
  SCENARIO,
  SHELTERS,
  SHELTER_SUMMARY,
  UNREACHED,
  VALIDATION,
} from "@/features/fixtures/fani";

import type { ScenarioData, StormOption } from "./types";

/**
 * SCENARIO REGISTRY.
 *
 * Maps a run id to its data. Today: one precomputed fixture run (Fani).
 * Tomorrow: `useScenario` fetches /scenarios/{runId} and this file shrinks to
 * the precomputed demo entries only.
 *
 * A run id is content-addressed on the backend (`params_hash`). The human
 * slug here is a frontend alias for the demo; live runs use the UUID.
 */

// Fani intensified fast: Alert 18h early, Warning 12h early, no separate
// Pre-Cyclone Watch bulletin. IMD's SOP explicitly permits this.
const FANI_STAGES: StageSpec[] = [
  {
    id: "watch",
    name: "Pre-Cyclone Watch",
    nominalHours: 72,
    issuedAtHours: null,
    skippedNote: "Actions folded into the Cyclone Alert packet.",
  },
  { id: "alert", name: "Cyclone Alert", nominalHours: 48, issuedAtHours: 66, packetStatus: "Packet issued" },
  { id: "warning", name: "Cyclone Warning", nominalHours: 24, issuedAtHours: 36, packetStatus: "Packet drafted" },
  { id: "postLandfall", name: "Post-Landfall Outlook", nominalHours: 12, issuedAtHours: null },
];

export const FANI_RUN_ID = "fani-2019-puri";

const FANI: ScenarioData = {
  meta: {
    runId: FANI_RUN_ID,
    storm: SCENARIO.storm,
    season: SCENARIO.season,
    district: SCENARIO.district,
    state: SCENARIO.state,
    landfallIso: SCENARIO.landfallIso,
    nowIso: SCENARIO.nowIso,
    nowHours: SCENARIO.nowHours,
    stage: SCENARIO.stage,
    stageName: "Cyclone Alert",
    precomputed: true,
    validated: true,
    isFixture: true,
  },
  stages: FANI_STAGES,
  actions: ACTIONS,
  shelters: SHELTERS,
  shelterSummary: { inDistrict: SHELTER_SUMMARY.inDistrict, compromised: SHELTER_SUMMARY.compromised },
  unreached: UNREACHED,
  headline: { ...HEADLINE },
  blocks: BLOCKS,
  validation: { ...VALIDATION },
  failures: FAILURES,
};

export const SCENARIOS: Record<string, ScenarioData> = {
  [FANI_RUN_ID]: FANI,
};

/**
 * The storm catalogue offered by the selector.
 *
 * Mirrors the backend's GET /storms catalogue and is overlaid with it when the
 * API is reachable. Truth/cross-check flags are the facts that decide what a
 * run can honestly claim:
 *  - Fani is the only Indian cyclone with a Copernicus EMS activation (EMSR357).
 *  - Michaung has no usable post-landfall Sentinel-1 granule; a validation
 *    score for it cannot exist and the backend returns 424 if asked.
 */
export const STORM_OPTIONS: StormOption[] = [
  {
    name: "FANI",
    season: 2019,
    district: "Puri",
    state: "Odisha",
    landfallLabel: "03 May 2019 · Puri",
    hasSarTruth: true,
    hasEmsActivation: true,
    note: "Validated run. Only Indian cyclone with an official Copernicus EMS cross-check.",
    runId: FANI_RUN_ID,
  },
  {
    name: "YAAS",
    season: 2021,
    district: "Bhadrak",
    state: "Odisha",
    landfallLabel: "26 May 2021 · Dhamra",
    hasSarTruth: true,
    hasEmsActivation: false,
    note: "Cleanest Sentinel-1 pre/landfall/post sequence of any candidate storm.",
  },
  {
    name: "AMPHAN",
    season: 2020,
    district: "South 24 Parganas",
    state: "West Bengal",
    landfallLabel: "20 May 2020 · Bakkhali",
    hasSarTruth: true,
    hasEmsActivation: false,
    note: "Costliest cyclone ever to strike India (~$13.5B in West Bengal).",
  },
  {
    name: "MICHAUNG",
    season: 2023,
    district: "Nellore",
    state: "Andhra Pradesh",
    landfallLabel: "05 Dec 2023 · Bapatla",
    hasSarTruth: false,
    hasEmsActivation: false,
    note: "No post-landfall Sentinel-1 imagery exists. Impact can be modelled; extent cannot be validated.",
  },
];
