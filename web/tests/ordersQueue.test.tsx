import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { JSX } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { OrderLedgerProvider } from "@/features/orders/orderLedger";
import { ActionQueueScreen } from "@/features/queue/ActionQueueScreen";
import { toScenarioData, type RunBundle } from "@/features/scenario/adapter";
import { ScenarioProvider } from "@/features/scenario/useScenario";

import bundleJson from "./fixtures/run-bundle.json";

vi.mock("@/map/ImpactMap", () => ({
  ImpactMap: ({ label }: { label: string }): JSX.Element => <div role="img" aria-label={label} />,
}));

const base = toScenarioData(bundleJson as unknown as RunBundle);
// The trimmed fixture stops at the Cyclone Alert stage; add one later order so
// folding has something to fold. Its fields are copied, not invented numbers.
const template = base.actions[0];
const later = template
  ? {
      ...template,
      id: "warning-test",
      stage: "warning" as const,
      title: "A Cyclone Warning order",
      deadline: new Date(new Date(base.meta.landfallIso).getTime() - 24 * 3_600_000).toISOString(),
    }
  : null;
const data = { ...base, actions: later ? [...base.actions, later] : base.actions };

function renderQueue() {
  localStorage.clear();
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OrderLedgerProvider>
          <ScenarioProvider value={data}>
            <ActionQueueScreen />
          </ScenarioProvider>
        </OrderLedgerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pressed = (): string | undefined =>
  screen.getAllByRole("button", { pressed: true })[0]?.textContent ?? undefined;

describe("order queue", () => {
  it("labels each group with its IMD stage and folds later stages", () => {
    renderQueue();
    const queue = screen.getByRole("complementary", { name: "Order queue" });
    const headers = within(queue).getAllByRole("button", { expanded: false });
    expect(headers.length).toBeGreaterThan(0);
    expect(headers[0]?.textContent).toMatch(/CYCLONE WARNING|POST-LANDFALL/);
    const before = within(queue).getAllByRole("checkbox").length;
    if (headers[0]) fireEvent.click(headers[0]);
    expect(within(queue).getAllByRole("checkbox").length).toBeGreaterThan(before);
  });

  it("arrow keys move the selection only inside the queue; j moves it anywhere", () => {
    renderQueue();
    const first = pressed();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(pressed()).toBe(first);
    const queue = screen.getByRole("complementary", { name: "Order queue" });
    fireEvent.keyDown(queue, { key: "ArrowDown" });
    const second = pressed();
    expect(second).not.toBe(first);
    fireEvent.keyDown(window, { key: "k" });
    expect(pressed()).toBe(first);
  });
});
