import { useId, type JSX, type ReactNode } from "react";

import * as styles from "./Term.css";

/**
 * A piece of jargon with its plain-language meaning one hover or tab away.
 *
 * The definition is in the DOM (aria-describedby), so a screen reader reads
 * it and keyboard focus reveals it; nothing needs a click.
 */

export const GLOSSARY = {
  csi: "Critical Success Index: how much the modelled flood and the satellite-observed flood overlap. 1 is a perfect match, 0 is no overlap.",
  surgeIndex:
    "A rough estimate of how high the sea is pushed onshore, scaled from wind speed and coastline shape. An index, not a forecast: quote IMD's figure in any order.",
  parametric:
    "An insurance-style payout that fires automatically when measured wind or flooding crosses a set threshold, with no loss survey. Amounts here are illustrative.",
  heuristic: "A rule-of-thumb estimate that has not passed a check against observed data.",
  modelled: "Computed from measured inputs (population, buildings), but inherits the uncertainty of the flood it sits on.",
  imdStage:
    "IMD's four cyclone warning stages: Pre-Cyclone Watch (about 72 h before landfall), Cyclone Alert (48 h), Cyclone Warning (24 h) and Post-Landfall Outlook.",
  bathtub:
    "Floods every connected low-lying cell below the surge level, spreading inland from the open sea. No tides, waves or rivers.",
} as const;

export type TermId = keyof typeof GLOSSARY;

export function Term({ id, children }: { id: TermId; children: ReactNode }): JSX.Element {
  const tipId = useId();
  return (
    <span className={styles.term} tabIndex={0} aria-describedby={tipId}>
      {children}
      <span id={tipId} role="tooltip" className={styles.tip}>
        {GLOSSARY[id]}
      </span>
    </span>
  );
}
