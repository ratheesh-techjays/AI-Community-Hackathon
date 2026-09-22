import { useId, useState, type JSX } from "react";

import { text } from "@/design/typography.css";

import { Icon, type IconName } from "./Icon";
import * as styles from "./DisclosureBadge.css";

/**
 * Marks every modelled number with the kind of model that produced it.
 *
 * Per the design system: "a number without one is a type error." That is
 * enforced upstream by `Disclosed<T>` in `@/types/disclosed` and by the
 * backend's Pydantic `Literal` types.
 *
 * The badge is visible AT REST -- never a bare number with a tooltip, because
 * it must be readable on a projector from the back of a room.
 */

export type DisclosureState = "heuristic" | "modelled" | "validated" | "fallback";

export interface DisclosureLimitations {
  /** How the value was produced. */
  method: string;
  /** Why this state and not a stronger one. */
  reason: string;
  /** IMD's own figure, where one exists. Shown beside ours, never hidden. */
  imd?: string;
  /** Physical processes the model does not capture. */
  notCaptured: string[];
  /** Model identifier, e.g. "surge-index v1". */
  model?: string;
  provenanceHref?: string;
}

interface DisclosureBadgeProps {
  state: DisclosureState;
  /** Required when state is "validated" — the badge shows it inline. */
  csi?: number;
  limitations: DisclosureLimitations;
  /** Larger variant for table column headers. */
  size?: "sm" | "lg";
}

const GLYPH: Record<DisclosureState, IconName> = {
  heuristic: "heuristic",
  modelled: "modelled",
  validated: "check",
  fallback: "missed",
};

const WORD: Record<DisclosureState, string> = {
  heuristic: "Heuristic",
  modelled: "Modelled",
  validated: "Validated",
  fallback: "Fallback",
};

export function DisclosureBadge({
  state,
  csi,
  limitations,
  size = "sm",
}: DisclosureBadgeProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  // The glyph never appears without its word, and `validated` carries the CSI.
  const label = state === "validated" && csi !== undefined ? `${WORD[state]} ${csi.toFixed(2)}` : WORD[state];

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.badge[state]}${size === "lg" ? ` ${styles.large}` : ""}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      >
        <Icon name={GLYPH[state]} size={12} />
        {label}
        <span className="sr-only">. Show model limitations.</span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${WORD[state]} — model limitations`}
          className={styles.popover}
        >
          <div className={styles.row}>
            <span className={`${text.metric} ${styles.rowLabel}`}>Method</span>
            <span className={text.body}>{limitations.method}</span>
          </div>
          <div className={styles.row}>
            <span className={`${text.metric} ${styles.rowLabel}`}>Why</span>
            <span className={text.body}>{limitations.reason}</span>
          </div>
          {limitations.model ? (
            <div className={styles.row}>
              <span className={`${text.metric} ${styles.rowLabel}`}>Model</span>
              <span className={text.metric}>{limitations.model}</span>
            </div>
          ) : null}

          {limitations.imd ? (
            <p className={`${text.body} ${styles.imdRow}`}>
              <strong>IMD forecast · {limitations.imd}</strong> — PRAHARI consumes IMD&rsquo;s
              authority and does not replace it.
            </p>
          ) : null}

          <div className={styles.row}>
            <span className={`${text.metric} ${styles.rowLabel}`}>Not captured</span>
            <ul className={`${text.body} ${styles.notCaptured}`}>
              {limitations.notCaptured.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {limitations.provenanceHref ? (
            <a
              className={`${text.caption} ${styles.provenance}`}
              href={limitations.provenanceHref}
            >
              Data provenance
            </a>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
