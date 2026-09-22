import type { JSX } from "react";

import { text } from "@/design/typography.css";

import { DisclosureBadge, type DisclosureLimitations, type DisclosureState } from "./DisclosureBadge";
import { Icon } from "./Icon";
import * as styles from "./StatCard.css";

/**
 * One headline number, its unit, its mandatory disclosure badge, and a
 * comparison row naming the external source it sits beside.
 *
 * The badge is not optional: "a StatCard without one does not compile" — hence
 * `badge` is a required prop, not an optional one.
 *
 * No sparklines, deltas or arrows. There is no trend in a landfall.
 */

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Denominator, e.g. "of 177". */
  denominator?: string;
  badge: {
    state: DisclosureState;
    csi?: number;
    limitations: DisclosureLimitations;
  };
  /** Lead with IMD whenever IMD has a figure. */
  compare?: { source: string; value: string; note?: string };
  /** A finding that demands an order. Max two per screen. */
  flag?: boolean;
}

export function StatCard({
  label,
  value,
  unit,
  denominator,
  badge,
  compare,
  flag = false,
}: StatCardProps): JSX.Element {
  return (
    <div className={`${styles.card}${flag ? ` ${styles.flagged}` : ""}`}>
      <div className={`${text.label} ${styles.label}`}>{label.toUpperCase()}</div>

      <div className={styles.valueRow}>
        <span
          className={`${text.headlineNumber} ${flag ? styles.valueFlagged : styles.value}`}
        >
          {flag ? <Icon name="compromised" size={28} /> : null}
          {value}
        </span>
        {unit ? <span className={`${text.bodyStrong} ${styles.unit}`}>{unit}</span> : null}
        {denominator ? (
          <span className={`${text.body} ${styles.unit}`}>{denominator}</span>
        ) : null}
        <DisclosureBadge
          state={badge.state}
          {...(badge.csi !== undefined ? { csi: badge.csi } : {})}
          limitations={badge.limitations}
        />
      </div>

      {compare ? (
        <div className={styles.compare}>
          <span className={`${text.label} ${styles.compareSource}`}>
            {compare.source.toUpperCase()}
          </span>
          <span className={text.clock}>{compare.value}</span>
          {compare.note ? <span className={text.caption}>{compare.note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
