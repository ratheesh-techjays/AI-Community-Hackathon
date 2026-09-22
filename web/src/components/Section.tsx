import type { JSX, ReactNode } from "react";

import { text } from "@/design/typography.css";

import * as styles from "./Section.css";

interface SectionProps {
  title: string;
  /** A short qualifier that would otherwise become a caption inside a box. */
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, note, actions, children }: SectionProps): JSX.Element {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={`${text.sectionTitle} ${styles.title}`}>{title}</h2>
        {note ? <span className={`${text.caption} ${styles.note}`}>{note}</span> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
