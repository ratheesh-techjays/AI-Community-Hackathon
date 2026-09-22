import { assignInlineVars } from "@vanilla-extract/dynamic";
import type { JSX } from "react";

import { text } from "@/design/typography.css";

import { Icon } from "./Icon";
import * as styles from "./StageTimeline.css";

/**
 * IMD's four warning stages on one track from T-84h to landfall.
 *
 * Nominal windows (IMD SOP, July 2024): Pre-Cyclone Watch T-72h, Cyclone Alert
 * T-48h, Cyclone Warning T-24h, Post-Landfall Outlook T-12h. Nominal markers
 * are dashed; bulletins actually issued are filled.
 *
 * The gap between dashed and filled marker is the story of a rapid
 * intensifier. Fani's Alert arrived at T-66h and its Warning at T-36h, both
 * earlier than nominal, because the storm intensified faster than the SOP's
 * standard sequence assumes. IMD's SOP explicitly permits skipping a stage, so
 * a skipped window is a real state, not an error.
 *
 * A skipped stage keeps its FULL width so the missed time stays visible.
 * The NOW pin is never animated.
 */

export type StageId = "watch" | "alert" | "warning" | "postLandfall";

export interface StageSpec {
  id: StageId;
  name: string;
  /** Nominal lead time in hours before landfall (72, 48, 24, 12). */
  nominalHours: number;
  /** Lead time at which the bulletin was actually issued, or null if none. */
  issuedAtHours: number | null;
  /** Where this stage's actions went, if it was skipped. */
  skippedNote?: string;
  packetStatus?: string;
}

interface StageTimelineProps {
  /** Hours before landfall for the current view (e.g. 48 for T-48h). */
  nowHours: number;
  stages: StageSpec[];
  /** Left edge of the track, in hours before landfall. */
  windowStartHours?: number;
}

/** Position along the track: T-84h at 0%, landfall at 100%. */
const pct = (hours: number, start: number): number =>
  Math.max(0, Math.min(100, ((start - hours) / start) * 100));

function deltaLabel(nominal: number, issued: number): string {
  const diff = issued - nominal;
  if (diff === 0) return "on nominal";
  return diff > 0 ? `${diff}h early` : `${Math.abs(diff)}h late`;
}

export function StageTimeline({
  nowHours,
  stages,
  windowStartHours = 84,
}: StageTimelineProps): JSX.Element {
  return (
    <section className={styles.wrapper} aria-label="IMD warning stage timeline">
      <div className={styles.track} role="presentation">
        {stages.map((stage, index) => {
          // A window is skipped when its nominal time has passed with no bulletin.
          const skipped = stage.issuedAtHours === null && stage.nominalHours >= nowHours;
          if (!skipped) return null;
          const previous = stages[index - 1];
          const from = previous ? previous.nominalHours : windowStartHours;
          const left = pct(from, windowStartHours);
          const right = pct(stage.nominalHours, windowStartHours);
          return (
            <div
              key={`skip-${stage.id}`}
              className={styles.skippedSegment}
              style={assignInlineVars({
                [styles.leftVar]: `${left}%`,
                [styles.widthVar]: `${Math.max(right - left, 0)}%`,
              })}
            />
          );
        })}

        {stages.map((stage) => (
          <div
            key={`nominal-${stage.id}`}
            className={styles.nominalMarker}
            style={assignInlineVars({
              [styles.posVar]: `${pct(stage.nominalHours, windowStartHours)}%`,
            })}
            title={`${stage.name} nominal T-${stage.nominalHours}h`}
          />
        ))}

        {stages.map((stage) =>
          stage.issuedAtHours === null ? null : (
            <div
              key={`issued-${stage.id}`}
              className={styles.issuedMarker[stage.id]}
              style={assignInlineVars({
                [styles.posVar]: `${pct(stage.issuedAtHours, windowStartHours)}%`,
              })}
              title={`${stage.name} issued T-${stage.issuedAtHours}h`}
            />
          ),
        )}

        <div
          className={styles.nowPin}
          style={assignInlineVars({ [styles.posVar]: `${pct(nowHours, windowStartHours)}%` })}
        >
          <span className={`${text.metric} ${styles.nowLabel}`}>NOW T-{nowHours}h</span>
        </div>
      </div>

      <p className={`${text.caption} ${styles.srCaption}`}>
        Track spans T-{windowStartHours}h to landfall. Dashed markers are IMD&rsquo;s nominal
        windows; filled markers are bulletins actually issued.
      </p>

      <div className={styles.cards}>
        {stages.map((stage) => {
          const skipped = stage.issuedAtHours === null && stage.nominalHours >= nowHours;
          const current = !skipped && stage.nominalHours >= nowHours;
          const classes = [
            styles.card,
            styles.cardAccent[stage.id],
            skipped ? styles.cardSkipped : "",
            current ? styles.cardCurrent : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <article key={stage.id} className={classes}>
              <span className={`${text.metric} ${styles.chip[stage.id]}`}>
                T-{stage.nominalHours}h
              </span>
              <span className={text.bodyStrong}>{stage.name}</span>

              {stage.issuedAtHours !== null ? (
                <span className={text.clock}>
                  issued T-{stage.issuedAtHours}h (
                  {deltaLabel(stage.nominalHours, stage.issuedAtHours)})
                </span>
              ) : skipped ? (
                <>
                  <span className={`${text.metric} ${styles.skippedTag}`}>
                    <Icon name="missed" size={12} />
                    SKIPPED
                  </span>
                  {stage.skippedNote ? (
                    <span className={`${text.caption} ${styles.meta}`}>{stage.skippedNote}</span>
                  ) : null}
                </>
              ) : (
                <span className={`${text.clock} ${styles.meta}`}>not yet issued</span>
              )}

              {stage.packetStatus ? (
                <span className={`${text.caption} ${styles.meta}`}>{stage.packetStatus}</span>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
