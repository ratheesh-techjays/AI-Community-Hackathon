import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { formatIST, OrderLedgerProvider, useOrderLedger } from "@/features/orders/orderLedger";

const wrapper = ({ children }: { children: ReactNode }) => (
  <OrderLedgerProvider>{children}</OrderLedgerProvider>
);

const ORDER = {
  subjectId: "SET-PUR-W7",
  action: "Evacuate Ward 7 to Chandanpur MCS by 18:00 IST",
  stage: "alert" as const,
  byRole: "Tahasildar, Puri Sadar",
};

describe("order ledger", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("records an order with a timestamp, never a bare boolean", () => {
    const { result } = renderHook(() => useOrderLedger(), { wrapper });

    act(() => result.current.toggle(ORDER));

    const entry = result.current.get(ORDER.subjectId);
    expect(entry).toBeDefined();
    // "Ordered" without "when" is useless in a post-event review.
    expect(entry?.orderedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry?.stage).toBe("alert");
    expect(entry?.byRole).toBe("Tahasildar, Puri Sadar");
  });

  it("toggles an order off again", () => {
    const { result } = renderHook(() => useOrderLedger(), { wrapper });

    act(() => result.current.toggle(ORDER));
    expect(result.current.isOrdered(ORDER.subjectId)).toBe(true);

    act(() => result.current.toggle(ORDER));
    expect(result.current.isOrdered(ORDER.subjectId)).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("persists across a remount", () => {
    const first = renderHook(() => useOrderLedger(), { wrapper });
    act(() => first.result.current.toggle(ORDER));
    first.unmount();

    const second = renderHook(() => useOrderLedger(), { wrapper });
    expect(second.result.current.isOrdered(ORDER.subjectId)).toBe(true);
  });

  it("survives unreadable storage rather than throwing", () => {
    window.localStorage.setItem("prahari.orders.v1", "{ not json");
    const { result } = renderHook(() => useOrderLedger(), { wrapper });
    expect(result.current.count).toBe(0);
  });

  it("formats times as 24-hour IST", () => {
    const formatted = formatIST("2019-05-01T12:30:00Z");
    expect(formatted).toMatch(/18:00/); // 12:30 UTC = 18:00 IST
    expect(formatted).not.toMatch(/AM|PM/);
  });
});
