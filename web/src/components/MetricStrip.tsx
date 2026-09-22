import type { JSX } from "react";

import { text } from "@/design/typography.css";

import {
  DisclosureBadge,
  type DisclosureLimitations,
  type DisclosureState,
} from "./DisclosureBadge";
import { Icon } from "./Icon";
import * as styles from "./MetricStrip.css";

/**
 * The headline figures as one readout strip.
 *
 * Replaces a grid of bordered cards. The disclosure badge is still mandatory
 * on every modelled figure -- the composition changed, the integrity rule
 * did not.
 */

export interface Metric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  denominator?: string;
  badge: { state: DisclosureState; csi?: number; limitations: DisclosureLimitations };
  /** The external source this figure sits beside. Lead with IMD where it has one. */
  compare?: string | undefined;
  /** A finding that demands an order. Keep to two per screen. */
  flag?: boolean;
}

export function MetricStrip({ metrics }: { metrics: Metric[] }): JSX.Element {
  return (
    <div className={styles.strip}>
      {metrics.map((m) => (
        <div
          key={m.key}
          className={`${styles.item}${m.flag ? ` ${styles.itemFlagged}` : ""}`}
        >
          <span className={`${text.label} ${styles.label}`}>{m.label.toUpperCase()}</span>

          <span className={styles.valueRow}>
            <span className={`${styles.value}${m.flag ? ` ${styles.valueFlagged}` : ""}`}>
              {m.flag ? <Icon name="compromised" size={20} /> : null}
              {m.value}
            </span>
            {m.unit ? <span className={`${text.bodyStrong} ${styles.unit}`}>{m.unit}</span> : null}
            {m.denominator ? (
              <span className={`${text.caption} ${styles.unit}`}>{m.denominator}</span>
            ) : null}
          </span>

          <span className={styles.valueRow}>
            <DisclosureBadge
              state={m.badge.state}
              {...(m.badge.csi !== undefined ? { csi: m.badge.csi } : {})}
              limitations={m.badge.limitations}
            />
            {m.compare ? (
              <span className={`${text.caption} ${styles.compare}`}>{m.compare}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
