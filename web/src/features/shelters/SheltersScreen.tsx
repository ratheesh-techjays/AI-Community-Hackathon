import { useMemo, useState, type JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { MetricStrip, type Metric } from "@/components/MetricStrip";
import { Section } from "@/components/Section";
import { text } from "@/design/typography.css";
import type { ScenarioData, ShelterRow, UnreachedRow } from "@/features/scenario/types";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./SheltersScreen.css";

/**
 * The shelters screen for a run: the register shelters inside the modelled
 * surge zone, and the flood clusters whose people have no shelter place.
 *
 * The compromised filter is selected on arrival — the Collector should never
 * have to go looking for the finding.
 */

type Filter = "compromised" | "all";

/** Largest clusters first; the rest one click away, so the page stays readable. */
const UNREACHED_PREVIEW = 15;

const fmt = (n: number): string => n.toLocaleString("en-IN");

function shelterColumns(limits: ScenarioData["limitations"]): Column<ShelterRow>[] {
  return [
    {
      key: "name",
      header: "Shelter",
      render: (row) => (
        <>
          <span className={text.bodyStrong}>{row.name}</span>
          <span className={`${text.metric} ${styles.subLine}`}>
            {row.osdmaId} · {row.block.toLowerCase()} · {row.district.toLowerCase()} · {row.shelterType}
          </span>
        </>
      ),
    },
    {
      key: "depth",
      header: "Depth at cell",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.surge },
      render: (row) => (row.depthM === null ? "—" : `${row.depthM.toFixed(2)} m`),
    },
    {
      key: "capacity",
      header: "Capacity",
      numeric: true,
      badge: { state: "modelled", limitations: limits.reachability },
      render: (row) => (row.capacity ? `${fmt(row.capacity)}${row.capacityImputed ? "*" : ""}` : "unknown type"),
    },
    {
      key: "assigned",
      header: "Assigned",
      numeric: true,
      badge: { state: "modelled", limitations: limits.reachability },
      render: (row) => fmt(row.assignedPopulation),
    },
    {
      key: "reassign",
      header: "Send its people to",
      badge: { state: "modelled", limitations: limits.reachability },
      render: (row) =>
        row.reassignTo === null ? (
          <span className={styles.subLine}>—</span>
        ) : (
          <>
            <span className={text.body}>{row.reassignTo}</span>
            <span className={`${text.metric} ${styles.subLine}`}>
              {fmt(row.displacedPopulation)} people · {row.reassignDistanceKm} km
            </span>
          </>
        ),
    },
  ];
}

function unreachedColumns(limits: ScenarioData["limitations"]): Column<UnreachedRow>[] {
  return [
    {
      key: "where",
      header: "Flood cluster",
      render: (row) => (
        <>
          <span className={text.bodyStrong}>{row.near}</span>
          <span className={`${text.metric} ${styles.subLine}`}>
            {row.id} · {row.block.toLowerCase()}
          </span>
        </>
      ),
    },
    {
      key: "population",
      header: "People",
      numeric: true,
      badge: { state: "modelled", limitations: limits.exposure },
      render: (row) => fmt(row.population),
    },
    { key: "nearest", header: "Nearest register shelter", render: (row) => row.nearestShelter },
    {
      key: "distance",
      header: "Est. road distance",
      numeric: true,
      render: (row) => (row.distanceKm === null ? "—" : `${row.distanceKm} km`),
    },
    {
      key: "reason",
      header: "Why no place",
      badge: { state: "modelled", limitations: limits.reachability },
      render: (row) => row.reason,
    },
  ];
}

export function SheltersScreen(): JSX.Element {
  const scenario = useScenario();
  const { meta, shelters, unreached, headline, limitations, map } = scenario;
  const [filter, setFilter] = useState<Filter>("compromised");
  const [allUnreached, setAllUnreached] = useState(false);
  const unreachedRows = allUnreached ? unreached : unreached.slice(0, UNREACHED_PREVIEW);

  const shelterRows = useMemo(
    () => (filter === "compromised" ? shelters.filter((s) => s.status === "compromised") : shelters),
    [filter, shelters],
  );
  const columns = useMemo(() => shelterColumns(limitations), [limitations]);
  const unreachedCols = useMemo(() => unreachedColumns(limitations), [limitations]);

  const metrics: Metric[] = [
    {
      key: "compromised",
      label: "Shelters compromised",
      value: String(headline.sheltersCompromised),
      denominator: `of ${headline.sheltersTotal}`,
      badge: { state: "heuristic", limitations: limitations.extent },
      compare: "OSDMA register, modelled area",
      flag: true,
    },
    {
      key: "unreached",
      label: "People with no shelter place",
      value: fmt(headline.unassignedPopulation),
      badge: { state: "modelled", limitations: limitations.reachability },
      compare: `of ${fmt(headline.assignedPopulation + headline.unassignedPopulation)} at risk`,
      flag: true,
    },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} />

      <Callout intent="limit" title="The three places this finding can be wrong">
        <strong>Reachability:</strong> a shelter counts as reachable within 10 km road distance,
        estimated as straight line × 1.3. No road network is modelled, so a road that floods first
        is not caught. <strong>Capacity:</strong> OSDMA publishes none; it is imputed from shelter
        type (marked *). <strong>Plinth:</strong> a shelter is judged by the modelled depth of its
        ~275 m grid cell, not its plinth height. Verify all three before issuing an order.
      </Callout>

      <Section title="Shelters in the surge zone">
        <ImpactMap
          bbox={map.bbox}
          flood={map.flood}
          shelters={map.shelters}
          label={`Map of ${meta.area}: modelled flood depth with ${headline.sheltersCompromised} compromised register shelters labelled.`}
        >
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
          All shelters in the area
        </button>
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => {
            window.print();
          }}
        >
          Print for village reading
        </button>
      </div>

      <Section title="Shelter register" note="Compromised first, then by name">
        <DataTable
          caption={`${shelterRows.length} shelters in view`}
          columns={columns}
          rows={shelterRows}
          stage={meta.stage}
          emptyMessage="No compromised shelters in this view."
        />
      </Section>

      <Section title="Flood clusters with no shelter place" note="After optimal assignment; each row says why">
        <DataTable
          caption={`${unreached.length} clusters, ${fmt(headline.unassignedPopulation)} people · largest first`}
          columns={unreachedCols}
          rows={unreachedRows}
          stage={meta.stage}
          emptyMessage="Every person in the modelled flood has a shelter place."
        />
        {unreached.length > UNREACHED_PREVIEW ? (
          <button
            type="button"
            className={styles.filterOff}
            aria-expanded={allUnreached}
            onClick={() => {
              setAllUnreached((v) => !v);
            }}
          >
            {allUnreached ? "Show the largest 15" : `Show all ${unreached.length} clusters`}
          </button>
        ) : null}
      </Section>
    </>
  );
}
