import type { JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { Section } from "@/components/Section";
import { validation as overlay } from "@/design/patterns.css";
import { text } from "@/design/typography.css";
import type { FailureRow } from "@/features/fixtures/fani";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./ValidationScreen.css";

/**
 * The evidence screen for a run: predicted extent, Sentinel-1 observed extent
 * and their overlay side by side; four skill metrics against the expected
 * range for this model class; and the mandatory table of where the model
 * fails — naming failures of the satellite truth as well as of the model.
 *
 * This is the only place a badge can earn `validated`, and the screen says
 * what that licenses: extent only. Depth, population and buildings stay
 * heuristic or modelled.
 *
 * A run with no satellite truth (e.g. Michaung) renders the honest "cannot be
 * validated" state instead of an empty panel.
 */

const FAILURE_COLUMNS: Column<FailureRow>[] = [
  {
    key: "where",
    header: "Where",
    render: (row) => <span className={text.bodyStrong}>{row.where}</span>,
  },
  { key: "what", header: "What", render: (row) => row.what },
  { key: "why", header: "Why", render: (row) => row.why },
  {
    key: "class",
    header: "Error class",
    render: (row) => (
      <span className={row.errorClass === "truth" ? styles.classTruth : styles.classModel}>
        {row.errorClass === "truth" ? "Truth" : "Model"}
      </span>
    ),
  },
  { key: "bias", header: "Direction", render: (row) => row.bias },
  {
    key: "area",
    header: "Area",
    numeric: true,
    render: (row) => (row.areaKm2 === 0 ? "—" : `${row.areaKm2.toFixed(1)} km²`),
  },
];

export function ValidationScreen(): JSX.Element {
  const { meta, validation, failures } = useScenario();

  if (!validation) {
    return (
      <Callout intent="limit" title="This run cannot be validated">
        No usable post-landfall Sentinel-1 imagery exists for Cyclone {meta.storm}, so there is no
        observed flood extent to score against. Impact figures for this run stay{" "}
        <strong>modelled</strong> and <strong>heuristic</strong>; none may carry the validated
        badge. The backend refuses to fabricate a score for such a storm (HTTP 424).
      </Callout>
    );
  }

  const { hits, misses, falseAlarms } = validation;

  const metrics = [
    {
      key: "csi",
      label: "CSI",
      value: validation.csi.toFixed(2),
      definition: "H / (H + M + F)",
      note: `expected ${validation.expectedRange[0].toFixed(2)}–${validation.expectedRange[1].toFixed(2)} for a parametric model`,
    },
    { key: "pod", label: "POD", value: validation.pod.toFixed(2), definition: "H / (H + M)", note: "probability of detection" },
    { key: "far", label: "FAR", value: validation.far.toFixed(2), definition: "F / (H + F)", note: "false alarm ratio" },
    { key: "bias", label: "BIAS", value: validation.bias.toFixed(2), definition: "(H + F) / (H + M)", note: "> 1 over-predicts extent" },
  ];

  return (
    <>
      <div className={styles.metricRow}>
        {metrics.map((metric) => (
          <div key={metric.key} className={styles.metricCard}>
            <span className={`${text.label} ${styles.metricLabel}`}>{metric.label}</span>
            <span className={`${text.headlineNumber} ${styles.metricValue}`}>{metric.value}</span>
            {/* Definitions in mono under each value: a reviewer should not have to ask. */}
            <span className={`${text.metric} ${styles.metricDefinition}`}>{metric.definition}</span>
            <span className={`${text.caption} ${styles.metricNote}`}>{metric.note}</span>
          </div>
        ))}
      </div>

      <div className={styles.mapRow}>
        <figure className={styles.mapFigure}>
          <div className={styles.wellPredicted}>
            <ImpactMap showWind={false} showTrack={false} pins={[]} />
            <span className={`${text.metric} ${styles.wellTag}`}>PREDICTED</span>
          </div>
          <figcaption className={`${text.caption} ${styles.figCaption}`}>
            Connectivity-constrained bathtub at {validation.surgeLevelUsedM} m on {validation.demAsset}
          </figcaption>
        </figure>

        <figure className={styles.mapFigure}>
          <div className={styles.wellObserved}>
            <ImpactMap showWind={false} showTrack={false} pins={[]} />
            <span className={`${text.metric} ${styles.wellTag}`}>OBSERVED</span>
          </div>
          <figcaption className={`${text.caption} ${styles.figCaption}`}>
            {validation.truthSource}, {validation.orbitPass} pass. Pre {validation.preWindow}, post{" "}
            {validation.postWindow}.
          </figcaption>
        </figure>

        <figure className={styles.mapFigure}>
          <div className={styles.mapWell}>
            <span className={`${styles.overlayBand} ${overlay.agreement}`} />
            <span className={`${styles.overlayBand} ${overlay.miss}`} />
            <span className={`${styles.overlayBand} ${overlay.falseAlarm}`} />
            <span className={`${text.metric} ${styles.wellTag}`}>OVERLAY</span>
          </div>
          <figcaption className={`${text.caption} ${styles.figCaption}`}>
            Agreement, miss and false alarm — distinguishable in greyscale.
          </figcaption>
        </figure>
      </div>

      <div className={styles.twoUp}>
        <section className={styles.panel}>
          <h2 className={text.sectionTitle}>Confusion table</h2>
          <table className={styles.confusion}>
            <caption className={`${text.caption} ${styles.figCaption}`}>
              Pixel counts reproducing the metrics above exactly.
            </caption>
            <tbody>
              <tr>
                <th scope="row" className={`${text.body} ${styles.confusionHead}`}>
                  Hits (predicted ∩ observed)
                </th>
                <td className={`${text.clock} ${styles.confusionCell}`}>{hits.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <th scope="row" className={`${text.body} ${styles.confusionHead}`}>
                  Misses (observed only)
                </th>
                <td className={`${text.clock} ${styles.confusionCell}`}>{misses.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <th scope="row" className={`${text.body} ${styles.confusionHead}`}>
                  False alarms (predicted only)
                </th>
                <td className={`${text.clock} ${styles.confusionCell}`}>
                  {falseAlarms.toLocaleString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>
          <p className={`${text.caption} ${styles.figCaption}`}>
            CSI, Threat Score and IoU are numerically identical for binary masks. We report CSI.
          </p>
        </section>

        <HazardLegend sections={["validation"]} />
      </div>

      <Callout intent="info" title="What this validation licenses — and what it does not">
        Flood <strong>extent</strong> for this storm and AOI may carry the <strong>validated</strong>{" "}
        badge, cross-checked against {validation.crossCheck}. Surge <strong>depth</strong> remains{" "}
        <strong>heuristic</strong> — no published Bay-of-Bengal wind-to-surge formula exists, and one
        matching run does not upgrade it. Population and building counts remain{" "}
        <strong>modelled</strong>: they inherit the hazard footprint&rsquo;s uncertainty and add
        exposure-layer uncertainty of their own.
      </Callout>

      <Section
        title="Where the model fails"
        note="Two of five are failures of the satellite truth, not the model"
      >
        <DataTable
          caption={`${failures.length} failure regions, by cause and error class`}
          columns={FAILURE_COLUMNS}
          rows={failures}
          stage={meta.stage}
        />
      </Section>
    </>
  );
}
