import { useMemo, useState, type JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { MetricStrip, type Metric } from "@/components/MetricStrip";
import { Section } from "@/components/Section";
import { text } from "@/design/typography.css";
import { EXPOSURE, REACHABILITY, SURGE } from "@/features/fixtures/disclosures";
import type { ShelterRow, UnreachedRow } from "@/features/fixtures/fani";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./SheltersScreen.css";

/**
 * The shelters screen for a run: the shelters inside the surge zone, and the
 * settlements whose people have no reachable shelter at all.
 *
 * The compromised filter is selected on arrival — the Collector should never
 * have to go looking for the finding.
 */

type Filter = "compromised" | "all";

const SHELTER_COLUMNS: Column<ShelterRow>[] = [
  {
    key: "name",
    header: "Shelter",
    render: (row) => (
      <>
        <span className={text.bodyStrong}>
          {/* Never invent a name for an unnamed register entry. */}
          {row.name ?? <em className={styles.unnamed}>No name in register</em>}
        </span>
        <span className={`${text.metric} ${styles.subLine}`}>
          {row.osdmaId} · {row.block} · {row.storeys}-storey
        </span>
      </>
    ),
  },
  {
    key: "depth",
    header: "Depth at footprint",
    numeric: true,
    badge: { state: "heuristic", limitations: SURGE },
    render: (row) => (row.depthM === null ? "—" : `${row.depthM.toFixed(1)} m`),
  },
  {
    key: "capacity",
    header: "Capacity",
    numeric: true,
    render: (row) => row.capacity.toLocaleString("en-IN"),
  },
  {
    key: "assigned",
    header: "Assigned",
    numeric: true,
    badge: { state: "modelled", limitations: EXPOSURE },
    render: (row) => row.assignedPopulation.toLocaleString("en-IN"),
  },
  {
    key: "reassign",
    header: "Reassign to",
    badge: { state: "modelled", limitations: REACHABILITY },
    render: (row) =>
      row.reassignTo === null ? (
        <span className={styles.subLine}>—</span>
      ) : (
        <>
          <span className={text.body}>{row.reassignTo}</span>
          <span className={`${text.metric} ${styles.subLine}`}>{row.reassignDistanceKm} km</span>
        </>
      ),
  },
];

const UNREACHED_COLUMNS: Column<UnreachedRow>[] = [
  {
    key: "settlement",
    header: "Settlement",
    render: (row) => (
      <>
        <span className={text.bodyStrong}>{row.settlement}</span>
        <span className={`${text.metric} ${styles.subLine}`}>
          {row.id} · {row.block}
        </span>
      </>
    ),
  },
  {
    key: "population",
    header: "People",
    numeric: true,
    badge: { state: "modelled", limitations: EXPOSURE },
    render: (row) => row.population.toLocaleString("en-IN"),
  },
  { key: "nearest", header: "Nearest usable", render: (row) => row.nearestUsable },
  {
    key: "distance",
    header: "Distance",
    numeric: true,
    render: (row) => `${row.distanceKm} km`,
  },
  {
    key: "reason",
    header: "Why unreachable",
    badge: { state: "modelled", limitations: REACHABILITY },
    render: (row) => row.reason,
  },
];

export function SheltersScreen(): JSX.Element {
  const { meta, shelters, shelterSummary, unreached } = useScenario();
  const [filter, setFilter] = useState<Filter>("compromised");

  const unreachedTotal = unreached.reduce((sum, r) => sum + r.population, 0);

  const shelterRows = useMemo(
    () => (filter === "compromised" ? shelters.filter((s) => s.status === "compromised") : shelters),
    [filter, shelters],
  );

  const metrics: Metric[] = [
    {
      key: "compromised",
      label: "Shelters compromised",
      value: String(shelterSummary.compromised),
      denominator: `of ${shelterSummary.inDistrict}`,
      badge: { state: "modelled", limitations: EXPOSURE },
      compare: "OSDMA register",
      flag: true,
    },
    {
      key: "unreached",
      label: "People with no shelter",
      value: unreachedTotal.toLocaleString("en-IN"),
      badge: { state: "modelled", limitations: REACHABILITY },
      compare: "≤ 5 km, road open to T-6h",
      flag: true,
    },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} />

      <Callout intent="limit" title="The two places this finding can be wrong">
        <strong>Reachability rule:</strong> a shelter counts as reachable if it is within 5 km on a
        road the model does not flood before T-6h. Road completeness in rural Odisha comes from
        OpenStreetMap and is patchy. <strong>Plinth assumption:</strong> a shelter is judged
        compromised by the modelled surge depth at its footprint. We do not hold plinth heights, so
        a raised shelter in shallow water may be flagged when it would stay dry. Verify both before
        issuing an order.
      </Callout>

      <Section title="Shelters in the surge zone">
        <ImpactMap showWind={false}>
          <HazardLegend sections={["flood", "assets"]} floating />
        </ImpactMap>
      </Section>

      <div className={styles.filterBar}>
        <span className={`${text.label} ${styles.filterLabel}`}>SHOW</span>
        <button
          type="button"
          className={filter === "compromised" ? styles.filterOn : styles.filterOff}
          onClick={() => {
            setFilter("compromised");
          }}
          aria-pressed={filter === "compromised"}
        >
          Compromised only
        </button>
        <button
          type="button"
          className={filter === "all" ? styles.filterOn : styles.filterOff}
          onClick={() => {
            setFilter("all");
          }}
          aria-pressed={filter === "all"}
        >
          All shelters in view
        </button>
        <button type="button" className={styles.exportButton}>
          Export PDF for village reading
        </button>
      </div>

      <Section title="Shelter register" note="Sorted by modelled depth at footprint">
        <DataTable
          caption={`${shelterRows.length} shelters in view`}
          columns={SHELTER_COLUMNS}
          rows={shelterRows}
          stage={meta.stage}
          emptyMessage="No compromised shelters in this view."
        />
      </Section>

      <Section
        title="Settlements with no reachable shelter"
        note="Within 5 km on a road the model does not flood before T-6h"
      >
        <DataTable
          caption={`${unreached.length} settlements, ${unreachedTotal.toLocaleString("en-IN")} people`}
          columns={UNREACHED_COLUMNS}
          rows={unreached}
          stage={meta.stage}
        />
      </Section>
    </>
  );
}
