/**
 * FIXTURE DATA — Cyclone Fani, Puri district, T-48h.
 *
 * ⚠ This is NOT live model output. The backend's L3 (exposure) and L4
 * (decision) layers are not built yet, so these screens read from here.
 *
 * The shapes below match the planned API responses in
 * docs/design/06-api-contracts.md exactly, so swapping to live data is a
 * one-line change in each feature hook, not a rewrite.
 *
 * Grounding rules followed here, same as the backend's:
 *   - Shelter names and districts are REAL, taken from the committed OSDMA
 *     register (data/raw/osdma_shelters.csv, 877 records, 177 in Puri).
 *   - An unnamed register entry shows its id and says the name is missing.
 *     We never invent a name.
 *   - Modelled quantities (depth, population, area) are illustrative and
 *     carry the disclosure state they would carry live.
 *   - IMD's own surge forecast (3.0–4.5 m) is the published figure for Fani.
 */

import type { RowStatus } from "@/components/DataTable";

export const SCENARIO = {
  storm: "Fani",
  season: 2019,
  district: "Puri",
  state: "Odisha",
  landfallIso: "2019-05-03T03:00:00+05:30",
  nowIso: "2019-05-01T08:00:00+05:30",
  nowHours: 48,
  stage: "alert" as const,
  isFixture: true,
} as const;

// --- shelters ---------------------------------------------------------------

export interface ShelterRow {
  id: string;
  status: RowStatus;
  orderAction?: string;
  orderRole?: string;
  /** OSDMA register id. Quotable in an order. */
  osdmaId: string;
  /** null when the register carries no name — never invented. */
  name: string | null;
  block: string;
  storeys: number;
  capacity: number;
  assignedPopulation: number;
  /** Modelled surge depth at the footprint, metres. */
  depthM: number | null;
  /** Where to send people instead, when this shelter is compromised. */
  reassignTo: string | null;
  reassignDistanceKm: number | null;
}

export const SHELTERS: ShelterRow[] = [
  {
    id: "OSDMA-PUR-041",
    status: "compromised",
    orderAction: "Reassign 1,850 people from Baliapanda to Chandanpur MCS",
    orderRole: "Tahasildar, Puri Sadar",
    osdmaId: "OSDMA-PUR-041",
    name: "BALIAPANDA",
    block: "Puri Sadar",
    storeys: 1,
    capacity: 1000,
    assignedPopulation: 1850,
    depthM: 2.1,
    reassignTo: "CHANDANPUR (OSDMA-PUR-112)",
    reassignDistanceKm: 3.4,
  },
  {
    id: "OSDMA-PUR-058",
    status: "compromised",
    orderAction: "Reassign 900 people from Penthakata to Talabania MFS",
    orderRole: "Tahasildar, Puri Sadar",
    osdmaId: "OSDMA-PUR-058",
    name: "PENTHAKATA",
    block: "Puri Sadar",
    storeys: 1,
    capacity: 500,
    assignedPopulation: 900,
    depthM: 1.7,
    reassignTo: "TALABANIA (OSDMA-PUR-087)",
    reassignDistanceKm: 2.2,
  },
  {
    id: "OSDMA-PUR-073",
    status: "compromised",
    orderAction: "Reassign 640 people from unnamed register entry 073",
    orderRole: "Tahasildar, Brahmagiri",
    osdmaId: "OSDMA-PUR-073",
    name: null, // register carries no name — do not invent one
    block: "Brahmagiri",
    storeys: 1,
    capacity: 500,
    assignedPopulation: 640,
    depthM: 1.4,
    reassignTo: "GUAGARIA (OSDMA-PUR-104)",
    reassignDistanceKm: 4.6,
  },
  {
    id: "OSDMA-PUR-091",
    status: "compromised",
    orderAction: "Reassign 1,200 people from Jalakoparia to Nimapada CHC",
    orderRole: "Tahasildar, Astaranga",
    osdmaId: "OSDMA-PUR-091",
    name: "JALAKOPARIA",
    block: "Astaranga",
    storeys: 1,
    capacity: 1000,
    assignedPopulation: 1200,
    depthM: 0.9,
    reassignTo: "NIMAPADA (OSDMA-PUR-130)",
    reassignDistanceKm: 5.9,
  },
  {
    id: "OSDMA-PUR-104",
    status: "safe",
    osdmaId: "OSDMA-PUR-104",
    name: "GUAGARIA",
    block: "Brahmagiri",
    storeys: 2,
    capacity: 1000,
    assignedPopulation: 720,
    depthM: 0,
    reassignTo: null,
    reassignDistanceKm: null,
  },
  {
    id: "OSDMA-PUR-112",
    status: "safe",
    osdmaId: "OSDMA-PUR-112",
    name: "CHANDANPUR",
    block: "Puri Sadar",
    storeys: 2,
    capacity: 1000,
    assignedPopulation: 430,
    depthM: 0,
    reassignTo: null,
    reassignDistanceKm: null,
  },
  {
    id: "OSDMA-PUR-126",
    status: "watch",
    osdmaId: "OSDMA-PUR-126",
    name: "MAHAGABA",
    block: "Astaranga",
    storeys: 2,
    capacity: 500,
    assignedPopulation: 480,
    depthM: 0.2,
    reassignTo: null,
    reassignDistanceKm: null,
  },
];

/** Headline counts. The full register has 177 rows for Puri. */
export const SHELTER_SUMMARY = {
  inDistrict: 177,
  compromised: 11,
  shown: SHELTERS.length,
} as const;

// --- settlements with no reachable shelter ----------------------------------

export interface UnreachedRow {
  id: string;
  status: RowStatus;
  orderAction?: string;
  orderRole?: string;
  settlement: string;
  block: string;
  population: number;
  nearestUsable: string;
  distanceKm: number;
  /** The reachability rule that failed. */
  reason: string;
}

export const UNREACHED: UnreachedRow[] = [
  {
    id: "SET-PUR-W7",
    status: "unreached",
    orderAction: "Evacuate Ward 7 to Chandanpur MCS by 18:00 IST",
    orderRole: "Tahasildar, Puri Sadar",
    settlement: "Ward 7, Puri municipality",
    block: "Puri Sadar",
    population: 2400,
    nearestUsable: "CHANDANPUR (OSDMA-PUR-112)",
    distanceKm: 6.8,
    reason: "Beyond 5 km; link road floods before T-6h",
  },
  {
    id: "SET-PUR-SAHI",
    status: "unreached",
    orderAction: "Evacuate Balisahi to Talabania MFS by 18:00 IST",
    orderRole: "Tahasildar, Puri Sadar",
    settlement: "Balisahi",
    block: "Puri Sadar",
    population: 820,
    nearestUsable: "TALABANIA (OSDMA-PUR-087)",
    distanceKm: 4.1,
    reason: "Only access road floods before T-6h",
  },
  {
    id: "SET-PUR-ARAK",
    status: "unreached",
    orderAction: "Evacuate Arakhakuda to Guagaria by 18:00 IST",
    orderRole: "Tahasildar, Brahmagiri",
    settlement: "Arakhakuda",
    block: "Brahmagiri",
    population: 640,
    nearestUsable: "GUAGARIA (OSDMA-PUR-104)",
    distanceKm: 7.2,
    reason: "Beyond 5 km; no all-weather link road in register",
  },
  {
    id: "SET-PUR-GOPI",
    status: "unreached",
    orderAction: "Evacuate Gopinathpur to Nimapada by 18:00 IST",
    orderRole: "Tahasildar, Astaranga",
    settlement: "Gopinathpur",
    block: "Astaranga",
    population: 340,
    nearestUsable: "NIMAPADA (OSDMA-PUR-130)",
    distanceKm: 5.4,
    reason: "Beyond 5 km",
  },
];

export const UNREACHED_TOTAL = UNREACHED.reduce((sum, r) => sum + r.population, 0);

// --- validation -------------------------------------------------------------

export const VALIDATION = {
  storm: "Fani 2019",
  aoi: "Puri + Khordha",
  csi: 0.38,
  pod: 0.61,
  far: 0.44,
  bias: 1.12,
  hits: 148_200,
  misses: 94_700,
  falseAlarms: 116_400,
  expectedRange: [0.3, 0.5] as const,
  truthSource: "Sentinel-1 GRD, VH ratio > 1.25",
  orbitPass: "DESCENDING" as const,
  preWindow: "20 Apr – 02 May 2019",
  postWindow: "04 – 09 May 2019",
  crossCheck: "Copernicus EMS EMSR357 (activated 02 May 2019, 9 AOIs)",
  surgeLevelUsedM: 3.2,
  imdForecastSurgeM: "3.0–4.5",
  demAsset: "COPERNICUS/DEM/GLO30_2024_1",
  demVerticalErrorM: 4,
} as const;

export interface FailureRow {
  id: string;
  status: RowStatus;
  where: string;
  what: string;
  why: string;
  /** Whether the error is the model's or the satellite truth's. */
  errorClass: "model" | "truth";
  /** Which way it pushes the score. */
  bias: string;
  areaKm2: number;
}

export const FAILURES: FailureRow[] = [
  {
    id: "F1",
    status: "watch",
    where: "Mahanadi delta, north of Astaranga",
    what: "Over-predicts extent",
    why: "No river discharge coupling; compound flooding is unmodelled",
    errorClass: "model",
    bias: "Inflates false alarms, lowers CSI",
    areaKm2: 41.2,
  },
  {
    id: "F2",
    status: "watch",
    where: "Inland of the Puri embankment",
    what: "Under-predicts extent",
    why: "30 m DEM does not resolve embankment crests or breaches",
    errorClass: "model",
    bias: "Inflates misses, lowers POD",
    areaKm2: 18.6,
  },
  {
    id: "F3",
    status: "watch",
    where: "Puri town core",
    what: "Truth under-detects",
    why: "Urban double-bounce: SAR returns a bright signal from flooded streets between buildings",
    errorClass: "truth",
    bias: "Observed extent too small — our CSI is pessimistic here",
    areaKm2: 9.4,
  },
  {
    id: "F4",
    status: "watch",
    where: "Paddy east of Brahmagiri",
    what: "Truth over-detects",
    why: "Irrigated paddy is radiometrically indistinguishable from shallow flood",
    errorClass: "truth",
    bias: "Observed extent too large — inflates our misses",
    areaKm2: 27.8,
  },
  {
    id: "F5",
    status: "watch",
    where: "Whole AOI",
    what: "Timing mismatch",
    why: "Post-landfall pass is ~30h after peak surge; fast-draining areas had receded",
    errorClass: "truth",
    bias: "Observed extent too small at the coast",
    areaKm2: 0,
  },
];

// --- situation overview headline numbers ------------------------------------

export const HEADLINE = {
  peakSurgeM: 3.2,
  areaFloodedKm2: 412,
  populationAtRisk: 184_000,
  buildingsAtRisk: 14_200,
  hospitalsAtRisk: 6,
  roadKmAffected: 89,
  sheltersCompromised: 11,
  unassignedPopulation: UNREACHED_TOTAL,
} as const;

export interface BlockRow {
  id: string;
  status: RowStatus;
  block: string;
  populationAtRisk: number;
  buildingsAtRisk: number;
  maxDepthM: number;
  sheltersCompromised: number;
}

export const BLOCKS: BlockRow[] = [
  {
    id: "BLK-PS",
    status: "compromised",
    block: "Puri Sadar",
    populationAtRisk: 96_400,
    buildingsAtRisk: 7_310,
    maxDepthM: 2.1,
    sheltersCompromised: 5,
  },
  {
    id: "BLK-BG",
    status: "compromised",
    block: "Brahmagiri",
    populationAtRisk: 41_200,
    buildingsAtRisk: 3_180,
    maxDepthM: 1.6,
    sheltersCompromised: 3,
  },
  {
    id: "BLK-AS",
    status: "compromised",
    block: "Astaranga",
    populationAtRisk: 28_900,
    buildingsAtRisk: 2_440,
    maxDepthM: 1.4,
    sheltersCompromised: 3,
  },
  {
    id: "BLK-KK",
    status: "watch",
    block: "Kakatpur",
    populationAtRisk: 12_300,
    buildingsAtRisk: 980,
    maxDepthM: 0.6,
    sheltersCompromised: 0,
  },
  {
    id: "BLK-NM",
    status: "safe",
    block: "Nimapada",
    populationAtRisk: 5_200,
    buildingsAtRisk: 290,
    maxDepthM: 0.2,
    sheltersCompromised: 0,
  },
];
