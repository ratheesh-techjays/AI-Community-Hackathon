import { assignInlineVars } from "@vanilla-extract/dynamic";
import type { JSX } from "react";

import { shimmer } from "@/design/effects.css";

import * as styles from "./Skeleton.css";

/**
 * Loading placeholder.
 *
 * This is the ONE place shimmer is used. Motion here communicates "not ready
 * yet", which is a real state worth animating. On loaded content, animation
 * would compete with the alerts that actually need attention.
 */

interface SkeletonProps {
  /** Rough width, e.g. "8rem" or "60%". */
  width?: string;
  height?: string;
  rounded?: boolean;
}

export function Skeleton({ width = "100%", height = "1rem", rounded }: SkeletonProps): JSX.Element {
  return (
    <span
      className={`${shimmer} ${styles.block}${rounded ? ` ${styles.rounded}` : ""}`}
      style={assignInlineVars({ [styles.wVar]: width, [styles.hVar]: height })}
      aria-hidden="true"
    />
  );
}

/** A StatCard-shaped placeholder, so the grid does not jump when data lands. */
export function StatCardSkeleton(): JSX.Element {
  return (
    <div className={styles.card} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton height="0.75rem" width="55%" />
      <Skeleton height="2.5rem" width="45%" />
      <Skeleton height="0.75rem" width="80%" />
    </div>
  );
}

/** A table-shaped placeholder. */
export function TableSkeleton({ rows = 5 }: { rows?: number }): JSX.Element {
  return (
    <div className={styles.table} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading table</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height="1.25rem" />
      ))}
    </div>
  );
}
