import type { JSX } from "react";
import { Link } from "react-router-dom";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { Icon } from "@/components/Icon";
import { MetricStrip, type Metric } from "@/components/MetricStrip";
import { Section } from "@/components/Section";
import { StageTimeline } from "@/components/StageTimeline";
import { Term } from "@/components/Term";
import { text } from "@/design/typography.css";
import { AskPanel } from "@/features/ask/AskPanel";
import { useOrderLedger } from "@/features/orders/orderLedger";
import { CoverageList } from "@/features/scenario/CoverageList";
import type { BlockRow, ScenarioData, ZoneRow } from "@/features/scenario/types";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./SituationScreen.css";

/**
 * THE HOME OF A RUN: what will happen, where, and what to do next.
 *
 * Read top to bottom: which storm and area this is, the one next step, the
 * trust verdict on the flood extent, the headline figures, the map, then the
 * detail tables so nothing on the map is only on the map.
 */

const fmt = (n: number): string => n.toLocaleString("en-IN");

const istDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

function blockColumns(limits: ScenarioData["limitations"], hasRegister: boolean): Column<BlockRow>[] {
  const columns: Column<BlockRow>[] = [
    {
      key: "block",
      header: "Block",
      render: (row) => (
        <>
          <span className={text.bodyStrong}>{row.block.toLowerCase()}</span>
          {row.district !== "—" ? <span className={text.caption}> · {row.district.toLowerCase()}</span> : null}
        </>
      ),
    },
    {
      key: "population",
      header: "People in the flood",
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
      header: "Deepest water",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.surge },
      render: (row) => `${row.maxDepthM.toFixed(1)} m`,
    },
    {
      key: "shelters",
      header: "Shelters in the flood",
      numeric: true,
      badge: { state: "heuristic", limitations: limits.extent },
      render: (row) => `${row.sheltersCompromised} of ${row.sheltersTotal}`,
    },
  ];
  // No register: a shelters column would only ever read "0 of 0".
  return hasRegister ? columns : columns.filter((c) => c.key !== "shelters");
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
      header: "B · share of people flooded",
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

function TrustLine(): JSX.Element {
  const { meta, validation, validationUnavailableReason } = useScenario();
  const evidence = `/scenarios/${meta.runId}/evidence`;
  if (validation?.passed) {
    return (
      <p className={`${text.body} ${styles.trustOk}`}>
        <Icon name="check" size={14} /> Flood extent checked against Sentinel-1 radar:{" "}
        <Term id="csi">CSI</Term> {validation.csi.toFixed(2)}. <Link to={evidence}>See the check</Link>
      </p>
    );
  }
  if (validation) {
    return (
      <p className={`${text.body} ${styles.trustWarn}`}>
        <Icon name="heuristic" size={14} />
        <span>
          <strong>Treat the flood extent as heuristic.</strong> Its satellite check scored{" "}
          <Term id="csi">CSI</Term> {validation.csi.toFixed(3)} (1 is a perfect match; below 0.25
          fails). <Link to={evidence}>Why</Link>
        </span>
      </p>
    );
  }
  return (
    <p className={`${text.body} ${styles.trustWarn}`}>
      <Icon name="heuristic" size={14} />
      <span>
        <strong>Flood extent not checked against satellite data.</strong>{" "}
        {validationUnavailableReason ?? "No satellite check was run."} <Link to={evidence}>Details</Link>
      </span>
    </p>
  );
}

export function SituationScreen(): JSX.Element {
  const scenario = useScenario();
  const { meta, stages, headline, blocks, zones, validation, limitations, map, actions } = scenario;
  const hasRegister = meta.coverage.shelters !== "none";
  const base = `/scenarios/${meta.runId}`;
  const ledger = useOrderLedger();
  // Same count as the nav badge: orders not yet ticked in the ledger.
  const open = actions.filter((a) => !ledger.isOrdered(a.id));
  const stageOpen = open.filter((a) => a.stage === meta.stage).length;
  // Stages run in IMD order: open orders from an earlier stage are overdue,
  // and when nothing is due now the note points at the next stage with work.
  const cur = stages.findIndex((st) => st.id === meta.stage);
  const stageAt = (id: string): number => stages.findIndex((st) => st.id === id);
  const overdue = open.filter((a) => stageAt(a.stage) < cur).length;
  const nextStage = stages.slice(cur + 1).find((st) => open.some((a) => a.stage === st.id));

  const allMetrics: Metric[] = [
    {
      key: "people",
      label: "People in the flood",
      value: fmt(headline.populationAtRisk),
      badge: { state: "modelled", limitations: limitations.exposure },
      compare: "WorldPop 2019",
    },
    {
      key: "area",
      label: "Flooded area",
      value: fmt(headline.areaFloodedKm2),
      unit: "km²",
      badge:
        validation?.passed
          ? { state: "validated", csi: validation.csi, limitations: limitations.extent }
          : { state: "heuristic", limitations: limitations.extent },
      compare: "connected to the sea",
    },
    {
      key: "shelters",
      label: "Shelters in the flood",
      value: String(headline.sheltersCompromised),
      denominator: `of ${headline.sheltersTotal}`,
      badge: { state: "heuristic", limitations: limitations.extent },
      compare: "OSDMA register",
      flag: headline.sheltersCompromised > 0,
    },
    {
      key: "unreached",
      label: "People with no shelter place",
      value: fmt(headline.unassignedPopulation),
      badge: { state: "modelled", limitations: limitations.reachability },
      compare: "within 10 km",
      flag: headline.unassignedPopulation > 0,
    },
    {
      key: "buildings",
      label: "Buildings in the flood",
      value: fmt(headline.buildingsAtRisk),
      badge: { state: "modelled", limitations: limitations.exposure },
      compare: "Open Buildings v3",
    },
    {
      key: "surge",
      label: "Surge index",
      term: "surgeIndex",
      value: headline.peakSurgeM.toFixed(1),
      unit: "m",
      badge: { state: "heuristic", limitations: limitations.surge },
      compare: "not a forecast",
    },
  ];

  // No register: shelter figures do not exist, so they are not shown as zeros.
  const metrics = hasRegister
    ? allMetrics
    : allMetrics.filter((m) => m.key !== "shelters" && m.key !== "unreached");

  return (
    <>
      <section className={styles.summary} aria-labelledby="run-title">
        <div className={styles.summaryText}>
          <span className={`${text.label} ${styles.eyebrow}`}>
            CYCLONE {meta.storm.toUpperCase()} · {meta.season} · REPLAY OF A PAST STORM
          </span>
          <h2 id="run-title" className={styles.summaryTitle}>
            {meta.area}
          </h2>
          <p className={`${text.body} ${styles.summaryLead}`}>
            Landfall {istDateTime(meta.landfallIso)} IST. Read as at the{" "}
            <Term id="imdStage">{meta.stageName}</Term> stage, {meta.nowHours} hours before landfall.
          </p>
          <TrustLine />
          <CoverageList data={scenario} />
        </div>
        <div className={styles.summaryActions}>
          <Link to={`${base}/orders`} className={styles.primary}>
            {open.length ? `Review ${open.length} open orders` : "Review orders"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
          <span className={`${text.caption} ${styles.actionNote}`}>
            {!open.length
              ? `All ${actions.length} orders recorded`
              : [
                  overdue ? `${overdue} overdue` : null,
                  stageOpen ? `${stageOpen} due at ${meta.stageName}` : null,
                  !overdue && !stageOpen && nextStage ? `next at ${nextStage.name}` : null,
                  `${actions.length} in all`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
          {hasRegister ? (
            <Link to={`${base}/shelters`} className={styles.secondaryLink}>
              See unsafe shelters
            </Link>
          ) : null}
        </div>
      </section>

      <MetricStrip metrics={metrics} />

      <Section
        title="Where"
        note={`Modelled flood depth, strongest wind and the storm track${hasRegister ? ", with register shelters" : ""}`}
      >
        <ImpactMap
          bbox={map.bbox}
          flood={map.flood}
          wind={map.wind}
          track={map.track}
          shelters={map.shelters}
          label={`Impact map of ${meta.area}: modelled flood depth, wind envelope, the track of Cyclone ${meta.storm}, and ${headline.sheltersCompromised} compromised shelters labelled. Every value is also in the tables below.`}
        >
          {/* Floating over cartography is the one place glass is correct. */}
          <HazardLegend sections={hasRegister ? ["flood", "wind", "assets"] : ["flood", "wind"]} floating />
        </ImpactMap>
      </Section>

      <Section title="When" note="Orders fall into IMD's four warning stages, counted back from landfall">
        <StageTimeline nowHours={meta.nowHours} stages={stages} />
      </Section>

      <AskPanel
        runId={meta.runId}
        topBlock={hasRegister ? (blocks.find((b) => b.sheltersCompromised > 0)?.block ?? blocks[0]?.block ?? null) : null}
      />

      <Section
        title={hasRegister ? "Block by block" : "Flooded area"}
        note={
          hasRegister
            ? "Blocks with people or shelters in the modelled flood"
            : "No register blocks here, so the area is one row"
        }
      >
        <DataTable
          caption={
            hasRegister
              ? `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"} in ${meta.area}, sorted by people in the flood`
              : `People and buildings in the modelled flood, ${meta.area}`
          }
          columns={blockColumns(limitations, hasRegister)}
          rows={blocks}
          stage={meta.stage}
        />
      </Section>

      <Section
        title="Parametric trigger"
        note={`Each zone pays the larger of trigger A and B · total ₹${headline.payoutCrore.toFixed(1)} crore, illustrative`}
      >
        <p className={`${text.caption} ${styles.define}`}>
          <Term id="parametric">Parametric trigger</Term>: an insurance-style payout that fires on
          measured wind or flooding, with no loss survey. The amounts show the mechanism; they are
          not actuarial.
        </p>
        <DataTable
          caption={`${zones.filter((z) => z.payoutCrore > 0).length} of ${zones.length} zones triggered`}
          columns={zoneColumns(limitations)}
          rows={zones}
          stage={meta.stage}
          statusTags={{
            watch: { word: "Triggered", glyph: "substation" },
            safe: { word: "Not triggered", glyph: "missed" },
          }}
        />
      </Section>

      <Callout intent="limit" title="What this model does not capture">
        Surge height is a heuristic index, not a forecast: quote IMD&rsquo;s figure in any order.
        Static inundation: no tide phase, no wave setup, no river discharge. DEM vertical error is
        comparable to the surge signal in low-relief terrain. Parametric thresholds and payouts are
        illustrative of the mechanism, not actuarial.
      </Callout>
    </>
  );
}
