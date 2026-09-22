import type { JSX } from "react";

import { flood, swatch, validation, wind } from "@/design/patterns.css";
import { text } from "@/design/typography.css";

import * as styles from "./HazardLegend.css";

/**
 * The map key, and the rule it enforces: every hazard class has a hue, a
 * pattern or stroke weight, and a word.
 *
 * The swatches use the SAME classes as the SVG map fills, so legend and map
 * cannot drift apart.
 *
 * Shallow is always first — never reorder the ramps.
 */

export type LegendSection = "flood" | "wind" | "validation" | "assets";

interface HazardLegendProps {
  sections: LegendSection[];
  /** Floats over the map (earns the one shadow) vs. a static block beside the table. */
  floating?: boolean;
}

const FLOOD = [
  { key: "shallow", cls: flood.shallow, label: "Shallow", threshold: "< 0.5 m" },
  { key: "moderate", cls: flood.moderate, label: "Moderate", threshold: "0.5–1.5 m" },
  { key: "deep", cls: flood.deep, label: "Deep", threshold: "> 1.5 m" },
] as const;

const WIND = [
  { key: "low", cls: wind.low, label: "Gale", threshold: "62–87 km/h" },
  { key: "moderate", cls: wind.moderate, label: "Storm", threshold: "88–117 km/h" },
  { key: "severe", cls: wind.severe, label: "Severe", threshold: "118–221 km/h" },
  { key: "extreme", cls: wind.extreme, label: "Extreme", threshold: "222+ km/h" },
] as const;

const VALIDATION = [
  { key: "agreement", cls: validation.agreement, label: "Agreement", note: "predicted ∩ observed" },
  { key: "miss", cls: validation.miss, label: "Miss", note: "observed, not predicted" },
  { key: "falseAlarm", cls: validation.falseAlarm, label: "False alarm", note: "predicted, not observed" },
  { key: "predicted", cls: validation.predicted, label: "Predicted", note: "solid outline" },
  { key: "observedTruth", cls: validation.observedTruth, label: "Observed", note: "dashed outline" },
] as const;

export function HazardLegend({ sections, floating = false }: HazardLegendProps): JSX.Element {
  return (
    <aside
      className={`${styles.legend}${floating ? ` ${styles.floating}` : ""}`}
      aria-label="Map legend"
    >
      {sections.includes("flood") ? (
        <section className={styles.group}>
          <h3 className={`${text.label} ${styles.groupTitle}`}>SURGE INDEX</h3>
          {FLOOD.map((item) => (
            <div key={item.key} className={styles.item}>
              <span className={`${swatch} ${item.cls}`} />
              <span className={text.body}>{item.label}</span>
              <span className={`${text.metric} ${styles.threshold}`}>{item.threshold}</span>
            </div>
          ))}
        </section>
      ) : null}

      {sections.includes("wind") ? (
        <section className={styles.group}>
          <h3 className={`${text.label} ${styles.groupTitle}`}>WIND</h3>
          {WIND.map((item) => (
            <div key={item.key} className={styles.item}>
              <span className={`${swatch} ${item.cls}`} />
              <span className={text.body}>{item.label}</span>
              <span className={`${text.metric} ${styles.threshold}`}>{item.threshold}</span>
            </div>
          ))}
        </section>
      ) : null}

      {sections.includes("validation") ? (
        <section className={styles.group}>
          <h3 className={`${text.label} ${styles.groupTitle}`}>VALIDATION OVERLAY</h3>
          {VALIDATION.map((item) => (
            <div key={item.key} className={styles.item}>
              <span className={`${swatch} ${item.cls}`} />
              <span className={text.body}>{item.label}</span>
              <span className={`${text.caption} ${styles.threshold}`}>{item.note}</span>
            </div>
          ))}
        </section>
      ) : null}

      {sections.includes("assets") ? (
        <section className={styles.group}>
          <h3 className={`${text.label} ${styles.groupTitle}`}>ASSETS</h3>
          <div className={styles.item}>
            <span className={styles.pinCompromised} />
            <span className={text.body}>Shelter — compromised</span>
          </div>
          <div className={styles.item}>
            <span className={styles.pinSafe} />
            <span className={text.body}>Shelter — usable</span>
          </div>
          <div className={styles.item}>
            <span className={styles.pinHospital} />
            <span className={text.body}>Hospital</span>
          </div>
        </section>
      ) : null}

      <p className={`${text.caption} ${styles.footnote}`}>
        Every class carries a hue, a pattern or stroke, and a word — readable in greyscale.
      </p>
    </aside>
  );
}
