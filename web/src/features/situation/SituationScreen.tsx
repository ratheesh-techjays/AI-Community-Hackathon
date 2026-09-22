import type { JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { MetricStrip, type Metric } from "@/components/MetricStrip";
import { Section } from "@/components/Section";
import { StageTimeline } from "@/components/StageTimeline";
import { text } from "@/design/typography.css";
import { EXPOSURE, EXTENT, REACHABILITY, SURGE } from "@/features/fixtures/disclosures";
import type { BlockRow } from "@/features/fixtures/fani";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

/**
 * The map screen for a run: stage ruler, one readout strip, the map as the
 * hero, then the block table so nothing on the map is only on the map.
 */

const BLOCK_COLUMNS: Column<BlockRow>[] = [
  {
    key: "block",
    header: "Block",
    render: (row) => <span className={text.bodyStrong}>{row.block}</span>,
  },
  {
    key: "population",
    header: "People at risk",
    numeric: true,
    badge: { state: "modelled", limitations: EXPOSURE },
    render: (row) => row.populationAtRisk.toLocaleString("en-IN"),
  },
  {
    key: "buildings",
    header: "Buildings",
    numeric: true,
    badge: { state: "modelled", limitations: EXPOSURE },
    render: (row) => row.buildingsAtRisk.toLocaleString("en-IN"),
  },
  {
    key: "depth",
    header: "Max depth",
    numeric: true,
    badge: { state: "heuristic", limitations: SURGE },
    render: (row) => `${row.maxDepthM.toFixed(1)} m`,
  },
  {
    key: "shelters",
    header: "Compromised",
    numeric: true,
    badge: { state: "modelled", limitations: REACHABILITY },
    render: (row) => String(row.sheltersCompromised),
  },
];

export function SituationScreen(): JSX.Element {
  const { meta, stages, headline, blocks, validation, unreached } = useScenario();
  const unreachedTotal = unreached.reduce((sum, r) => sum + r.population, 0);

  const metrics: Metric[] = [
    {
      key: "surge",
      label: "Peak surge",
      value: headline.peakSurgeM.toFixed(1),
      unit: "m",
      badge: { state: "heuristic", limitations: SURGE },
      compare: validation ? `IMD ${validation.imdForecastSurgeM} m` : undefined,
    },
    {
      key: "area",
      label: "Area flooded",
      value: String(headline.areaFloodedKm2),
      unit: "km²",
      badge: validation
        ? { state: "validated", csi: validation.csi, limitations: EXTENT }
        : { state: "modelled", limitations: EXTENT },
      compare: validation ? "vs Sentinel-1" : "not yet validated",
    },
    {
      key: "people",
      label: "People at risk",
      value: headline.populationAtRisk.toLocaleString("en-IN"),
      badge: { state: "modelled", limitations: EXPOSURE },
      compare: "WorldPop 100 m",
    },
    {
      key: "buildings",
      label: "Buildings",
      value: headline.buildingsAtRisk.toLocaleString("en-IN"),
      badge: { state: "modelled", limitations: EXPOSURE },
      compare: "Open Buildings v3",
    },
    {
      key: "shelters",
      label: "Shelters compromised",
      value: String(headline.sheltersCompromised),
      denominator: `of ${meta.district === "Puri" ? 177 : "—"}`,
      badge: { state: "modelled", limitations: REACHABILITY },
      compare: "OSDMA register",
      flag: true,
    },
    {
      key: "unreached",
      label: "No reachable shelter",
      value: unreachedTotal.toLocaleString("en-IN"),
      badge: { state: "modelled", limitations: REACHABILITY },
      compare: "≤ 5 km rule",
      flag: true,
    },
  ];

  return (
    <>
      <StageTimeline nowHours={meta.nowHours} stages={stages} />

      <MetricStrip metrics={metrics} />

      <Section title="Impact map" note="Surge index bands, wind bands, track and shelters">
        <ImpactMap>
          {/* Floating over cartography is the one place glass is correct. */}
          <HazardLegend sections={["flood", "wind", "assets"]} floating />
        </ImpactMap>
      </Section>

      <Section title="Block by block" note="Nothing on the map is only on the map">
        <DataTable
          caption={`${blocks.length} blocks in ${meta.district} district, sorted by population at risk`}
          columns={BLOCK_COLUMNS}
          rows={blocks}
          stage={meta.stage}
        />
      </Section>

      <Callout intent="limit" title="What this model does not capture">
        Surge height is a calibrated index, not a forecast — quote IMD&rsquo;s figure in any order.
        Static inundation: no tide phase, no wave setup, no river discharge coupling at the delta.
        DEM vertical error is comparable to the surge signal in low-relief terrain.
      </Callout>
    </>
  );
}
