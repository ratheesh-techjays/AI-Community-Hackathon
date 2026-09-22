import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import type { StageId } from "@/components/StageTimeline";

/**
 * THE ORDER LEDGER.
 *
 * A checkbox in a PRAHARI table is not a UI toggle — it records that an
 * official ordered something, at a time, during a named IMD stage. That is
 * durable, auditable state, so it gets a real shape rather than a boolean.
 *
 * Design decisions:
 *
 * 1. WRITES ARE OPTIMISTIC AND LOCAL FIRST. A District Collector ticking off
 *    an evacuation order at T-48h cannot wait on a round trip, and the tool
 *    must keep working when connectivity in a field office does not.
 *
 * 2. THE TIMESTAMP IS RECORDED, NEVER DERIVED LATER. "Ordered" without "when"
 *    is useless in a post-event review, which is exactly when this record
 *    matters most.
 *
 * 3. THE STAGE IS PART OF THE ENTRY. The same action ordered at T-48h and at
 *    T-12h are different decisions; the packet they belong to is the context
 *    that makes the record meaningful.
 *
 * TODO(backend): persist to POST /scenarios/{id}/orders. The entry shape below
 * is the request body. Until then localStorage carries it across reloads so a
 * demo or a field session survives a refresh.
 */

export interface OrderEntry {
  /** Stable row identifier — an OSDMA id, a settlement id, an action id. */
  subjectId: string;
  /** What was ordered, in the words shown to the officer. */
  action: string;
  /** IMD stage during which the order was given. */
  stage: StageId;
  /** ISO-8601, recorded at the moment of the tick. */
  orderedAt: string;
  /** Office that gave it. */
  byRole: string;
}

interface OrderLedgerValue {
  entries: Record<string, OrderEntry>;
  isOrdered: (subjectId: string) => boolean;
  get: (subjectId: string) => OrderEntry | undefined;
  toggle: (input: Omit<OrderEntry, "orderedAt">) => void;
  count: number;
}

const STORAGE_KEY = "prahari.orders.v1";

const OrderLedgerContext = createContext<OrderLedgerValue | null>(null);

function loadInitial(): Record<string, OrderEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OrderEntry>) : {};
  } catch {
    // Private mode, blocked storage, corrupt JSON: an empty ledger is correct.
    return {};
  }
}

export function OrderLedgerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [entries, setEntries] = useState<Record<string, OrderEntry>>(loadInitial);

  const persist = useCallback((next: Record<string, OrderEntry>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Never let a storage failure block an order being recorded in memory.
    }
  }, []);

  const toggle = useCallback<OrderLedgerValue["toggle"]>(
    (input) => {
      setEntries((prev) => {
        const next = prev[input.subjectId]
          ? Object.fromEntries(Object.entries(prev).filter(([id]) => id !== input.subjectId))
          : { ...prev, [input.subjectId]: { ...input, orderedAt: new Date().toISOString() } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const value = useMemo<OrderLedgerValue>(
    () => ({
      entries,
      isOrdered: (id) => Boolean(entries[id]),
      get: (id) => entries[id],
      toggle,
      count: Object.keys(entries).length,
    }),
    [entries, toggle],
  );

  return <OrderLedgerContext.Provider value={value}>{children}</OrderLedgerContext.Provider>;
}

export function useOrderLedger(): OrderLedgerValue {
  const ctx = useContext(OrderLedgerContext);
  if (!ctx) throw new Error("useOrderLedger must be used inside OrderLedgerProvider");
  return ctx;
}

/** 24-hour IST, the register officials actually use. */
export function formatIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
