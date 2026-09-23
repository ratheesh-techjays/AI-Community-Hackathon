import type { JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { MetricStrip, type Metric } from "@/components/MetricStrip";
import { Section } from "@/components/Section";
import { StageTimeline } from "@/components/StageTimeline";
import { text } from "@/design/typography.css";
import { AskPanel } from "@/features/ask/AskPanel";
import type { BlockRow, ScenarioData, ZoneRow } from "@/features/scenario/types";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

/**
 * The map screen for a run: stage ruler, one readout strip, the map as the
 * hero, then the block and trigger tables so nothing on the map is only on
 * the map.
 */

const fmt = (n: number): string => n.toLocaleString("en-IN");

function blockColumns(limits: ScenarioData["limitations"]): Column<BlockRow>[] {
  return [
    {
      key: "block",
      header: "Block",
      render: (row) => (
        <>
          <span className={text.bodyStrong}>{row.block.toLowerCase()}</span>
          <span className={text.caption}> · {row.district.toLowerCase()}</span>
        </>
      ),
    },
    {
      key: "population",
      header: "People at risk",
      numeric: true,
      badge: { state: "modelled", limitations: limits.exposure },
      render: (row) => fmt(row.populationAtRisk),
    },
    {
      key: "buildings",
      header: "Buildings",
      numeric: true,
      badge: { state: "modelled", limitations: limits.exposure },
      render: (row) => fmt(row.buildingsAtRisk),
    },
    {
      key: "depth",
      header: "Max depth",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.surge },
      render: (row) => `${row.maxDepthM.toFixed(1)} m`,
    },
    {
      key: "shelters",
      header: "Shelters compromised",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.extent },
      render: (row) => `${row.sheltersCompromised} of ${row.sheltersTotal}`,
    },
  ];
}

function zoneColumns(limits: ScenarioData["limitations"]): Column<ZoneRow>[] {
  return [
    { key: "zone", header: "Zone", render: (row) => <span className={text.bodyStrong}>{row.zone.toLowerCase()}</span> },
    {
      key: "wind",
      header: "A · peak wind",
      numeric: true,
      badge: { state: "modelled", limitations: limits.parametric },
      render: (row) => `${row.windMs.toFixed(1)} m/s${row.windTier ? ` (${row.windTier})` : ""}`,
    },
    {
      key: "pop",
      header: "B · flooded share",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.parametric },
      render: (row) => `${(row.populationIndex * 100).toFixed(1)}%${row.populationTier ? ` (${row.populationTier})` : ""}`,
    },
    {
      key: "payout",
      header: "Payout (illustrative)",
      numeric: true,
      render: (row) => (row.payoutCrore ? `₹${row.payoutCrore.toFixed(1)} cr` : "—"),
    },
  ];
}

export function SituationScreen(): JSX.Element {
  const { meta, stages, headline, blocks, zones, validation, limitations, map } = useScenario();

  const metrics: Metric[] = [
    {
      key: "surge",
      label: "Surge level used",
      value: headline.peakSurgeM.toFixed(2),
      unit: "m",
      badge: { state: "heuristic", limitations: limitations.surge },
      compare: "IMD bulletin figure not ingested",
    },
    {
      key: "area",
      label: "Area flooded",
      value: fmt(headline.areaFloodedKm2),
      unit: "km²",
      badge:
        validation?.passed
          ? { state: "validated", csi: validation.csi, limitations: limitations.extent }
          : { state: "heuristic", limitations: limitations.extent },
      compare: `naive threshold: ${fmt(headline.naiveAreaKm2)} km²`,
    },
    {
      key: "people",
      label: "People at risk",
      value: fmt(headline.populationAtRisk),
      badge: { state: "modelled", limitations: limitations.exposure },
      compare: "WorldPop 2019, 100 m",
    },
    {
      key: "buildings",
      label: "Buildings",
      value: fmt(headline.buildingsAtRisk),
      badge: { state: "modelled", limitations: limitations.exposure },
      compare: "Open Buildings v3",
    },
    {
      key: "shelters",
      label: "Shelters compromised",
      value: String(headline.sheltersCompromised),
      denominator: `of ${headline.sheltersTotal}`,
      badge: { state: "heuristic", limitations: limitations.extent },
      compare: "OSDMA register",
      flag: true,
    },
    {
      key: "unreached",
      label: "No shelter place",
      value: fmt(headline.unassignedPopulation),
      badge: { state: "modelled", limitations: limitations.reachability },
      compare: "≤ 10 km (straight line × 1.3)",
      flag: true,
    },
  ];

  return (
    <>
      <StageTimeline nowHours={meta.nowHours} stages={stages} />

      <MetricStrip metrics={metrics} />

      <AskPanel runId={meta.runId} />

      <Section title="Impact map" note="Surge-index depth bands, wind envelope, IBTrACS track and shelters">
        <ImpactMap
          bbox={map.bbox}
          flood={map.flood}
          wind={map.wind}
          track={map.track}
          shelters={map.shelters}
          label={`Impact map of ${meta.area}: modelled flood depth, wind envelope, the track of Cyclone ${meta.storm}, and ${headline.sheltersCompromised} compromised shelters labelled. Every value is also in the tables below.`}
        >
          {/* Floating over cartography is the one place glass is correct. */}
          <HazardLegend sections={["flood", "wind", "assets"]} floating />
        </ImpactMap>
      </Section>

      <Section title="Block by block" note="Nothing on the map is only on the map">
        <DataTable
          caption={`${blocks.length} blocks in ${meta.area}, sorted by people at risk`}
          columns={blockColumns(limitations)}
          rows={blocks}
          stage={meta.stage}
        />
      </Section>

      <Section
        title="Parametric trigger"
        note={`Each zone pays the larger of trigger A and B · total ₹${headline.payoutCrore.toFixed(1)} crore, illustrative`}
      >
        <DataTable
          caption={`${zones.filter((z) => z.payoutCrore > 0).length} of ${zones.length} zones triggered`}
          columns={zoneColumns(limitations)}
          rows={zones}
          stage={meta.stage}
        />
      </Section>

      <Callout intent="limit" title="What this model does not capture">
        Surge height is a heuristic index, not a forecast — quote IMD&rsquo;s figure in any order.
        Static inundation: no tide phase, no wave setup, no river discharge. DEM vertical error is
        comparable to the surge signal in low-relief terrain. Parametric thresholds and payouts are
        illustrative of the mechanism, not actuarial.
      </Callout>
    </>
  );
}
