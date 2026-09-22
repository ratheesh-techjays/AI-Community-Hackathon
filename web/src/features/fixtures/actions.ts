/**
 * THE ACTION PACKET — Cyclone Fani, Cyclone Alert stage (T-48h), Puri.
 *
 * This is the product's primary object. Everything else on screen exists to
 * give a Collector the confidence to tick one of these.
 *
 * Each action is: WHAT to order · WHO carries it out · BY WHEN · and the
 * EVIDENCE that justifies it, with the disclosure state of every figure.
 *
 * ⚠ Fixture data. Shelter names are real (OSDMA register); populations,
 * depths and deadlines are illustrative. Shapes match the planned
 * GET /scenarios/{id}/decisions response.
 */

import type { DisclosureState } from "@/components/DisclosureBadge";
import type { StageId } from "@/components/StageTimeline";

export type ActionKind =
  | "evacuate"
  | "reassign"
  | "infrastructure"
  | "staging"
  | "logistics"
  | "health";

export interface Evidence {
  label: string;
  value: string;
  state: DisclosureState;
}

export interface Action {
  id: string;
  kind: ActionKind;
  /** Imperative, one line. What the order says. */
  title: string;
  /** Office that carries it out. Never a person's name. */
  owner: string;
  /** ISO-8601 with IST offset. */
  deadline: string;
  stage: StageId;
  /** People this order moves or protects. */
  people: number;
  /** One sentence: where and why, in the words an officer would use. */
  summary: string;
  evidence: Evidence[];
  /** Ids of shelters / settlements this touches, for cross-linking. */
  related: string[];
  /** Where the map should focus when this action is selected. */
  mapFocus: { x: number; y: number; label: string };
  /** Pre-recorded in the ledger (already ordered before this session). */
  preOrdered?: boolean;
}

// Scenario clock: 01 May 2019 08:00 IST. Landfall 03 May 03:00 IST.

export const ACTIONS: Action[] = [
  {
    id: "ACT-01",
    kind: "evacuate",
    title: "Evacuate Ward 7 to Chandanpur MCS",
    owner: "Tahasildar, Puri Sadar",
    deadline: "2019-05-01T18:00:00+05:30",
    stage: "alert",
    people: 2400,
    summary:
      "2,400 people have no reachable shelter. The two nearest are inside the surge zone and the link road floods before T-6h. Chandanpur MCS (6.8 km) is the nearest usable shelter with capacity.",
    evidence: [
      { label: "Modelled depth at ward", value: "1.9 m", state: "heuristic" },
      { label: "Nearest usable shelter", value: "Chandanpur · 6.8 km", state: "modelled" },
      { label: "Road open until", value: "T-6h (flood-fill)", state: "modelled" },
      { label: "Chandanpur spare capacity", value: "570", state: "modelled" },
    ],
    related: ["SET-PUR-W7", "OSDMA-PUR-112"],
    mapFocus: { x: 228, y: 226, label: "Ward 7" },
  },
  {
    id: "ACT-02",
    kind: "reassign",
    title: "Reassign Baliapanda shelter population to Chandanpur MCS",
    owner: "Tahasildar, Puri Sadar",
    deadline: "2019-05-01T18:00:00+05:30",
    stage: "alert",
    people: 1850,
    summary:
      "Baliapanda MCS is single-storey and its footprint sits at 2.1 m modelled depth — the deepest of any shelter in the district. 1,850 people are currently assigned to it.",
    evidence: [
      { label: "Depth at footprint", value: "2.1 m", state: "heuristic" },
      { label: "Storeys", value: "1", state: "validated" },
      { label: "Assigned population", value: "1,850", state: "modelled" },
      { label: "Reassign distance", value: "3.4 km", state: "modelled" },
    ],
    related: ["OSDMA-PUR-041", "OSDMA-PUR-112"],
    mapFocus: { x: 214, y: 214, label: "Baliapanda" },
  },
  {
    id: "ACT-03",
    kind: "reassign",
    title: "Reassign Penthakata shelter population to Talabania MFS",
    owner: "Tahasildar, Puri Sadar",
    deadline: "2019-05-01T18:00:00+05:30",
    stage: "alert",
    people: 900,
    summary: "Penthakata MCS footprint at 1.7 m modelled depth. Talabania MFS is 2.2 km inland with capacity.",
    evidence: [
      { label: "Depth at footprint", value: "1.7 m", state: "heuristic" },
      { label: "Assigned population", value: "900", state: "modelled" },
      { label: "Reassign distance", value: "2.2 km", state: "modelled" },
    ],
    related: ["OSDMA-PUR-058", "OSDMA-PUR-087"],
    mapFocus: { x: 286, y: 236, label: "Penthakata" },
  },
  {
    id: "ACT-04",
    kind: "evacuate",
    title: "Evacuate Balisahi to Talabania MFS",
    owner: "Tahasildar, Puri Sadar",
    deadline: "2019-05-01T18:00:00+05:30",
    stage: "alert",
    people: 820,
    summary: "Balisahi's only access road floods before T-6h. Talabania is 4.1 km — within rule, but only while the road is open.",
    evidence: [
      { label: "Road open until", value: "T-6h", state: "modelled" },
      { label: "Distance to Talabania", value: "4.1 km", state: "modelled" },
    ],
    related: ["SET-PUR-SAHI", "OSDMA-PUR-087"],
    mapFocus: { x: 262, y: 246, label: "Balisahi" },
  },
  {
    id: "ACT-05",
    kind: "reassign",
    title: "Reassign register entry OSDMA-PUR-073 to Guagaria",
    owner: "Tahasildar, Brahmagiri",
    deadline: "2019-05-01T20:00:00+05:30",
    stage: "alert",
    people: 640,
    summary:
      "This shelter carries no name in the OSDMA register — quote the id. Footprint at 1.4 m modelled depth. Guagaria (two-storey, 4.6 km) has capacity.",
    evidence: [
      { label: "Depth at footprint", value: "1.4 m", state: "heuristic" },
      { label: "Register name", value: "none recorded", state: "validated" },
      { label: "Reassign distance", value: "4.6 km", state: "modelled" },
    ],
    related: ["OSDMA-PUR-073", "OSDMA-PUR-104"],
    mapFocus: { x: 150, y: 242, label: "OSDMA-PUR-073" },
  },
  {
    id: "ACT-06",
    kind: "evacuate",
    title: "Evacuate Arakhakuda to Guagaria",
    owner: "Tahasildar, Brahmagiri",
    deadline: "2019-05-01T20:00:00+05:30",
    stage: "alert",
    people: 640,
    summary: "7.2 km to the nearest usable shelter and no all-weather link road in the register. Start early.",
    evidence: [
      { label: "Distance to Guagaria", value: "7.2 km", state: "modelled" },
      { label: "All-weather road", value: "not in register", state: "validated" },
    ],
    related: ["SET-PUR-ARAK", "OSDMA-PUR-104"],
    mapFocus: { x: 168, y: 232, label: "Arakhakuda" },
  },
  {
    id: "ACT-07",
    kind: "reassign",
    title: "Reassign Jalakoparia shelter population to Nimapada",
    owner: "Tahasildar, Astaranga",
    deadline: "2019-05-01T20:00:00+05:30",
    stage: "alert",
    people: 1200,
    summary: "Jalakoparia MCS footprint at 0.9 m. Nimapada is 5.9 km — beyond the 5 km rule, but the only usable shelter with 1,200 spare places.",
    evidence: [
      { label: "Depth at footprint", value: "0.9 m", state: "heuristic" },
      { label: "Reassign distance", value: "5.9 km · exceeds rule", state: "modelled" },
      { label: "Nimapada spare capacity", value: "1,300", state: "modelled" },
    ],
    related: ["OSDMA-PUR-091", "OSDMA-PUR-130"],
    mapFocus: { x: 372, y: 196, label: "Jalakoparia" },
  },
  {
    id: "ACT-08",
    kind: "evacuate",
    title: "Evacuate Gopinathpur to Nimapada",
    owner: "Tahasildar, Astaranga",
    deadline: "2019-05-01T20:00:00+05:30",
    stage: "alert",
    people: 340,
    summary: "5.4 km to Nimapada. Marginally beyond rule; road stays open.",
    evidence: [{ label: "Distance to Nimapada", value: "5.4 km", state: "modelled" }],
    related: ["SET-PUR-GOPI", "OSDMA-PUR-130"],
    mapFocus: { x: 396, y: 178, label: "Gopinathpur" },
  },
  {
    id: "ACT-09",
    kind: "health",
    title: "Move critical patients from DHH Puri to Capital Hospital, Bhubaneswar",
    owner: "Chief District Medical Officer",
    deadline: "2019-05-01T22:00:00+05:30",
    stage: "alert",
    people: 46,
    summary: "DHH Puri sits inside the moderate surge band. Ground-floor ICU and generator room are exposed.",
    evidence: [
      { label: "Depth at hospital", value: "0.8 m", state: "heuristic" },
      { label: "Critical in-patients", value: "46", state: "validated" },
    ],
    related: ["HOSP-DHH-PURI"],
    mapFocus: { x: 236, y: 168, label: "DHH Puri" },
  },
  {
    id: "ACT-10",
    kind: "staging",
    title: "Pre-position one NDRF team at Brahmagiri block office",
    owner: "Special Relief Commissioner",
    deadline: "2019-05-01T22:00:00+05:30",
    stage: "alert",
    people: 0,
    summary: "Brahmagiri has the most settlements likely to lose road access. Staging here reaches Arakhakuda and OSDMA-PUR-073 after landfall.",
    evidence: [
      { label: "Settlements cut off after T-6h", value: "3", state: "modelled" },
      { label: "Road km lost", value: "31", state: "modelled" },
    ],
    related: ["BLK-BG"],
    mapFocus: { x: 176, y: 180, label: "Brahmagiri" },
  },
  {
    id: "ACT-11",
    kind: "infrastructure",
    title: "Schedule de-energisation of feeders F-12 and F-14 (Baliapanda substation)",
    owner: "CESU Control Room, Puri",
    deadline: "2019-05-02T15:00:00+05:30",
    stage: "warning",
    people: 0,
    summary: "Substation at 1.6 m modelled depth. Isolating before inundation prevents equipment loss and shortens restoration.",
    evidence: [
      { label: "Depth at substation", value: "1.6 m", state: "heuristic" },
      { label: "Customers on feeders", value: "11,400", state: "validated" },
    ],
    related: ["SUB-BALIAPANDA"],
    mapFocus: { x: 206, y: 200, label: "Baliapanda substation" },
  },
  {
    id: "ACT-12",
    kind: "infrastructure",
    title: "Stage CESU restoration crews and poles at Nimapada",
    owner: "CESU Divisional Engineer",
    deadline: "2019-05-02T06:00:00+05:30",
    stage: "alert",
    people: 0,
    summary: "Nimapada is outside all surge bands and inside the gale band only. Crews staged here can move in once winds drop.",
    evidence: [
      { label: "Wind band at Nimapada", value: "Gale", state: "modelled" },
      { label: "Surge depth", value: "0 m", state: "heuristic" },
    ],
    related: ["BLK-NM"],
    mapFocus: { x: 402, y: 146, label: "Nimapada" },
  },
  {
    id: "ACT-13",
    kind: "logistics",
    title: "Pre-position drinking water tankers at Chandanpur and Talabania",
    owner: "Executive Engineer, PHED",
    deadline: "2019-05-02T06:00:00+05:30",
    stage: "alert",
    people: 4200,
    summary: "The two receiving shelters will hold ~4,200 reassigned people beyond their planned load.",
    evidence: [{ label: "Reassigned population", value: "4,180", state: "modelled" }],
    related: ["OSDMA-PUR-112", "OSDMA-PUR-087"],
    mapFocus: { x: 268, y: 138, label: "Chandanpur" },
  },
  {
    id: "ACT-14",
    kind: "infrastructure",
    title: "Close Puri–Konark Marine Drive to civilian traffic",
    owner: "Executive Engineer, R&B",
    deadline: "2019-05-02T06:00:00+05:30",
    stage: "alert",
    people: 0,
    summary: "The road runs inside the moderate band for 14 km and is the main evacuation route out of Astaranga — keep it for evacuation buses only.",
    evidence: [{ label: "Length inside surge band", value: "14 km", state: "modelled" }],
    related: ["ROAD-MARINE-DRIVE"],
    mapFocus: { x: 330, y: 212, label: "Marine Drive" },
  },
  // ---- already ordered earlier in this stage ----
  {
    id: "ACT-15",
    kind: "logistics",
    title: "Open six school buildings in Puri Sadar as additional shelters",
    owner: "Block Development Officer, Puri Sadar",
    deadline: "2019-05-01T12:00:00+05:30",
    stage: "alert",
    people: 3000,
    summary: "Dedicated MCS capacity in Puri Sadar is exceeded by the reassignments above.",
    evidence: [{ label: "Capacity shortfall", value: "2,900", state: "modelled" }],
    related: ["BLK-PS"],
    mapFocus: { x: 240, y: 190, label: "Puri Sadar" },
    preOrdered: true,
  },
  {
    id: "ACT-16",
    kind: "logistics",
    title: "Recall all fishing vessels; close Puri and Astaranga harbours",
    owner: "Assistant Director, Fisheries",
    deadline: "2019-05-01T10:00:00+05:30",
    stage: "alert",
    people: 0,
    summary: "Standard Cyclone Alert action. IMD bulletin 8 advises fishermen not to venture out.",
    evidence: [{ label: "IMD advisory", value: "Bulletin 8", state: "validated" }],
    related: [],
    mapFocus: { x: 300, y: 262, label: "Puri harbour" },
    preOrdered: true,
  },
  {
    id: "ACT-17",
    kind: "logistics",
    title: "Activate community kitchens at Chandanpur and Talabania",
    owner: "Block Development Officer, Puri Sadar",
    deadline: "2019-05-01T14:00:00+05:30",
    stage: "alert",
    people: 4200,
    summary: "Receiving shelters for the reassignments above.",
    evidence: [{ label: "Expected occupancy", value: "4,180", state: "modelled" }],
    related: ["OSDMA-PUR-112", "OSDMA-PUR-087"],
    mapFocus: { x: 268, y: 138, label: "Chandanpur" },
    preOrdered: true,
  },
  {
    id: "ACT-18",
    kind: "staging",
    title: "Test EWDS siren towers in Puri Sadar and Brahmagiri",
    owner: "Special Relief Commissioner",
    deadline: "2019-05-01T09:00:00+05:30",
    stage: "alert",
    people: 0,
    summary: "Odisha EWDS: 122 towers across 6 coastal districts. Puri towers must be confirmed before the Warning stage.",
    evidence: [{ label: "Towers in district", value: "31", state: "validated" }],
    related: [],
    mapFocus: { x: 240, y: 236, label: "Puri coast" },
    preOrdered: true,
  },
];

export const KIND_LABEL: Record<ActionKind, string> = {
  evacuate: "Evacuation",
  reassign: "Shelter reassignment",
  infrastructure: "Infrastructure",
  staging: "Pre-positioning",
  logistics: "Logistics",
  health: "Health",
};
