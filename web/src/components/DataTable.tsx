import type { JSX, ReactNode } from "react";

import { rowHover } from "@/design/effects.css";
import { text } from "@/design/typography.css";
import { formatIST, useOrderLedger } from "@/features/orders/orderLedger";

import { DisclosureBadge, type DisclosureLimitations, type DisclosureState } from "./DisclosureBadge";
import { Icon, type IconName } from "./Icon";
import * as styles from "./DataTable.css";
import type { StageId } from "./StageTimeline";

/**
 * The equivalent of every map insight.
 *
 * Captioned, sticky header, right-aligned mono numerics, semantic row states
 * that carry a glyph and a word as well as a tint, and a checkbox column that
 * writes into the order ledger.
 *
 * Deliberately NOT here: hidden "details" drawers (the officer at the back
 * must read the depth from the row) and zebra striping (the tints mean
 * something).
 */

export type RowStatus = "compromised" | "unreached" | "watch" | "safe";

const STATUS_TAG: Record<RowStatus, { word: string; glyph: IconName }> = {
  compromised: { word: "Compromised", glyph: "compromised" },
  unreached: { word: "No shelter", glyph: "missed" },
  watch: { word: "Watch", glyph: "clock" },
  safe: { word: "Usable", glyph: "check" },
};

export interface Column<T> {
  key: string;
  header: string;
  /** Right-aligned, mono, tabular. */
  numeric?: boolean;
  /** A modelled column carries a badge in its header. */
  badge?: { state: DisclosureState; csi?: number; limitations: DisclosureLimitations };
  render: (row: T) => ReactNode;
}

export interface TableRow {
  id: string;
  status: RowStatus;
  /** What ticking the checkbox records as ordered. Omit to hide the column. */
  orderAction?: string;
  orderRole?: string;
}

interface DataTableProps<T extends TableRow> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  /** Stage the ledger attributes an order to. */
  stage: StageId;
  emptyMessage?: string;
}

export function DataTable<T extends TableRow>({
  caption,
  columns,
  rows,
  stage,
  emptyMessage = "No rows match this filter.",
}: DataTableProps<T>): JSX.Element {
  const ledger = useOrderLedger();
  const showOrders = rows.some((r) => r.orderAction);

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
          <caption className={styles.caption}>
            <span className={text.sectionTitle}>{caption}</span>
          </caption>

          <thead className={styles.thead}>
            <tr>
              {showOrders ? (
                <th scope="col" className={`${text.label} ${styles.th} ${styles.orderCell}`}>
                  Ordered
                </th>
              ) : null}
              <th scope="col" className={`${text.label} ${styles.th}`}>
                Status
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${text.label} ${styles.th}${col.numeric ? ` ${styles.thNumeric}` : ""}`}
                >
                  {col.header}
                  {col.badge ? (
                    <>
                      {" "}
                      <DisclosureBadge
                        state={col.badge.state}
                        {...(col.badge.csi !== undefined ? { csi: col.badge.csi } : {})}
                        limitations={col.badge.limitations}
                      />
                    </>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className={`${text.body} ${styles.empty}`}
                  colSpan={columns.length + (showOrders ? 2 : 1)}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const tag = STATUS_TAG[row.status];
                const entry = ledger.get(row.id);
                return (
                  <tr key={row.id} className={`${rowHover} ${styles.row[row.status]}`}>
                    {showOrders ? (
                      <td className={`${styles.td} ${styles.orderCell}`}>
                        {row.orderAction ? (
                          <label className={`${text.caption} ${styles.orderLabel}`}>
                            <input
                              type="checkbox"
                              checked={Boolean(entry)}
                              onChange={() => {
                                ledger.toggle({
                                  subjectId: row.id,
                                  action: row.orderAction ?? "",
                                  stage,
                                  byRole: row.orderRole ?? "District Collector",
                                });
                              }}
                            />
                            <span className="sr-only">Mark ordered: {row.orderAction}</span>
                            {entry ? (
                              <span className={`${text.metric} ${styles.orderedAt}`}>
                                {formatIST(entry.orderedAt)}
                              </span>
                            ) : null}
                          </label>
                        ) : null}
                      </td>
                    ) : null}

                    <td className={styles.td}>
                      <span className={`${text.metric} ${styles.tag[row.status]}`}>
                        <Icon name={tag.glyph} size={12} />
                        {tag.word}
                      </span>
                    </td>

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${text.body} ${styles.td}${col.numeric ? ` ${styles.tdNumeric}` : ""}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
      </table>
    </div>
  );
}
