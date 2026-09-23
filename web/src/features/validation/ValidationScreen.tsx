import type { JSX } from "react";

import { Callout } from "@/components/Callout";
import { DataTable, type Column } from "@/components/DataTable";
import { HazardLegend } from "@/components/HazardLegend";
import { Section } from "@/components/Section";
import { text } from "@/design/typography.css";
import { useScenario } from "@/features/scenario/useScenario";
import { ImpactMap } from "@/map/ImpactMap";

import * as styles from "./ValidationScreen.css";

/**
 * The evidence screen: predicted extent vs Sentinel-1 observed extent, four
 * skill metrics against the expected band for this model class, the
 * sensitivity sweep, and the computed failure analysis.
 *
 * The score shown is the score measured. A run below the CSI floor says so at
 * the top and never earns the validated badge anywhere in the app.
 */

interface SensitivityRow {
  id: string;
  status: "watch" | "safe";
  surgeLevelM: number;
  csi: number;
  areaKm2: number;
}

const SENSITIVITY_COLUMNS: Column<SensitivityRow>[] = [
  { key: "level", header: "Surge level", numeric: true, render: (r) => `${r.surgeLevelM.toFixed(2)} m` },
  { key: "area", header: "Modelled flood", numeric: true, render: (r) => `${r.areaKm2.toLocaleString("en-IN")} km²` },
  { key: "csi", header: "CSI", numeric: true, render: (r) => r.csi.toFixed(3) },
];

const fmtDates = (dates: string[]): string => (dates.length ? dates.join(", ") : "—");

export function ValidationScreen(): JSX.Element {
  const { meta, validation, validationUnavailableReason, map } = useScenario();

  if (!validation) {
    return (
      <Callout intent="limit" title="This run was not validated">
        {validationUnavailableReason ??
          "No usable post-landfall Sentinel-1 pair exists for this storm."}{" "}
        Impact figures for this run stay <strong>modelled</strong> and <strong>heuristic</strong>;
        none carries the validated badge. The backend refuses to fabricate a score (HTTP 424 for
        storms with no satellite truth).
      </Callout>
    );
  }

  const v = validation;
  const [lo, hi] = v.expectedRange;
  const metrics = [
    { key: "csi", label: "CSI", value: v.csi.toFixed(3), definition: "H / (H + M + F)", note: `expected ${lo.toFixed(2)}–${hi.toFixed(2)} for a parametric model` },
    { key: "pod", label: "POD", value: v.pod.toFixed(3), definition: "H / (H + M)", note: "probability of detection" },
    { key: "far", label: "FAR", value: v.far.toFixed(3), definition: "F / (H + F)", note: "false alarm ratio" },
    { key: "bias", label: "BIAS", value: v.bias.toFixed(2), definition: "(H + F) / (H + M)", note: "> 1 over-predicts extent" },
  ];
  const sensitivity: SensitivityRow[] = v.sensitivity.map((p) => ({
    id: String(p.surgeLevelM),
    status: p.surgeLevelM === v.surgeLevelUsedM ? "watch" : "safe",
    surgeLevelM: p.surgeLevelM,
    csi: p.csi,
    areaKm2: p.areaKm2,
  }));

  return (
    <>
      {v.passed ? (
        <Callout intent="info" title={`Extent validated: CSI ${v.csi.toFixed(2)}`}>
          Flood <strong>extent</strong> for this storm and area may carry the validated badge.
          Depth stays heuristic and exposure stays modelled — one matching run does not upgrade them.
        </Callout>
      ) : (
        <Callout intent="warning" title={`Validation attempted — CSI ${v.csi.toFixed(3)}, below the 0.25 floor`}>
          The modelled flood and the Sentinel-1 observed flood barely overlap. We report the score we
          measured, not the one we wanted, and we did not tune the model to it. The flood extent stays{" "}
          <strong>heuristic</strong> everywhere in this app. {v.degenerate ? "A score this close to zero is itself a bug signal, so the truth pipeline is flagged for review below." : ""}
        </Callout>
      )}

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

      <Section title="Predicted vs observed" note="Agreement, miss and false alarm, told apart by hue and pattern">
        <ImpactMap
          bbox={map.bbox}
          overlay={v.layer}
          track={map.track}
          label={`Validation overlay for ${meta.area}: ${v.hitsKm2} km² agreement, ${v.missesKm2} km² observed only, ${v.falseAlarmsKm2} km² predicted only.`}
          caption={`Bathtub at ${v.surgeLevelUsedM} m on ${v.demAsset} vs ${v.truthSource}, ${v.orbitPass.toLowerCase()} pass`}
        >
          <HazardLegend sections={["validation"]} floating />
        </ImpactMap>
      </Section>

      <div className={styles.twoUp}>
        <section className={styles.panel}>
          <h2 className={text.sectionTitle}>Confusion table</h2>
          <table className={styles.confusion}>
            <caption className={`${text.caption} ${styles.figCaption}`}>
              ~275 m grid cells on land, reproducing the metrics above exactly.
            </caption>
            <tbody>
              {[
                ["Hits (predicted ∩ observed)", v.hits, v.hitsKm2],
                ["Misses (observed only)", v.misses, v.missesKm2],
                ["False alarms (predicted only)", v.falseAlarms, v.falseAlarmsKm2],
              ].map(([label, cells, km2]) => (
                <tr key={String(label)}>
                  <th scope="row" className={`${text.body} ${styles.confusionHead}`}>
                    {label}
                  </th>
                  <td className={`${text.clock} ${styles.confusionCell}`}>
                    {Number(cells).toLocaleString("en-IN")} · {Number(km2).toLocaleString("en-IN")} km²
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`${text.caption} ${styles.figCaption}`}>
            Pre-event passes {fmtDates(v.preDates)}; post-event {fmtDates(v.postDates)}. Same relative
            orbit pre and post. {v.crossCheck}
          </p>
        </section>

        <section className={styles.panel}>
          <h2 className={text.sectionTitle}>Sensitivity to the surge level</h2>
          <DataTable
            caption="CSI if the surge index were higher or lower (row in use highlighted)"
            columns={SENSITIVITY_COLUMNS}
            rows={sensitivity}
            stage={meta.stage}
          />
        </section>
      </div>

      <Section title="Where and why the model fails" note="Computed from the confusion map, not written by hand">
        <ul className={styles.failures}>
          {v.failureAnalysis.map((note) => (
            <li key={note} className={text.body}>
              {note}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
