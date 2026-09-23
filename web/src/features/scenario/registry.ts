import type { StormOption } from "./types";

/**
 * The precomputed demo runs. Computed by the real pipeline and stored by the
 * backend (data/runs/, alias below):
 *
 *     python -m prahari.workers.scenario --storm FANI --season 2019 \
 *         --aoi puri_khordha --validate --alias fani-2019-puri
 */
export const FANI_RUN_ID = "fani-2019-puri";

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
    note: "Precomputed from Earth Engine data. The only Indian cyclone with an official Copernicus EMS activation.",
    aoiPreset: "puri_khordha",
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
    note: "Precomputed. A same-orbit Sentinel-1 pair exists (14 and 26 May 2021), but the modelled flood is small and nothing in the swath was scorable.",
    aoiPreset: "balasore_bhadrak",
    runId: "yaas-2021-balasore",
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
