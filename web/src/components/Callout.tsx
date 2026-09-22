import type { JSX, ReactNode } from "react";

import { text } from "@/design/typography.css";

import { Icon, type IconName } from "./Icon";
import * as styles from "./Callout.css";

/**
 * A bordered block for the one thing on a screen that needs attention now.
 *
 * Guidelines: never stack more than two — a screen with three alarms has none.
 * `role="alert"` only on `danger`. Actions only on `danger`.
 */

export type CalloutIntent = "danger" | "warning" | "info" | "limit";

export interface CalloutAction {
  label: string;
  onSelect: () => void;
}

interface CalloutProps {
  intent: CalloutIntent;
  title: string;
  children: ReactNode;
  /** danger only; the first is primary. */
  actions?: CalloutAction[];
}

const GLYPH: Record<CalloutIntent, IconName> = {
  danger: "compromised",
  warning: "clock",
  info: "satellite",
  limit: "heuristic",
};

export function Callout({ intent, title, children, actions }: CalloutProps): JSX.Element {
  const showActions = intent === "danger" && actions && actions.length > 0;

  return (
    <div
      className={styles.callout[intent]}
      {...(intent === "danger" ? { role: "alert" as const } : {})}
    >
      <span className={styles.glyph[intent]}>
        <Icon name={GLYPH[intent]} size={18} />
      </span>

      <div className={styles.bodyWrap}>
        <div className={`${text.sectionTitle} ${styles.title}`}>{title}</div>
        <div className={`${text.body} ${styles.body}`}>{children}</div>

        {showActions ? (
          <div className={styles.actions}>
            {actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                className={index === 0 ? styles.action.primary : styles.action.secondary}
                onClick={action.onSelect}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
