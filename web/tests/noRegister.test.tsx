import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { OrderLedgerProvider } from "@/features/orders/orderLedger";
import { ActionQueueScreen } from "@/features/queue/ActionQueueScreen";
import { toScenarioData, type RunBundle } from "@/features/scenario/adapter";
import { ScenarioProvider } from "@/features/scenario/useScenario";
import { SheltersScreen } from "@/features/shelters/SheltersScreen";
import { SituationScreen } from "@/features/situation/SituationScreen";
import { ValidationScreen } from "@/features/validation/ValidationScreen";

import bundleJson from "./fixtures/run-bundle-no-register.json";

vi.mock("@/map/ImpactMap", () => ({
  ImpactMap: ({ label, children }: { label: string; children?: JSX.Element }) => (
    <figure>
      <div role="img" aria-label={label} />
      {children}
    </figure>
  ),
}));

// Real engine output for Hudhud 2014 (Andhra Pradesh): no shelter register,
// no scorable Sentinel-1 pair.
const data = toScenarioData(bundleJson as unknown as RunBundle);

function renderScreen(node: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OrderLedgerProvider>
          <ScenarioProvider value={data}>{node}</ScenarioProvider>
        </OrderLedgerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("a run on a coast with no shelter register", () => {
  it("is labelled honestly by the backend", () => {
    expect(data.meta.coverage.shelters).toBe("none");
    expect(data.meta.coverage.validation).toBe("not_scorable");
    expect(data.shelters).toEqual([]);
  });

  it.each([
    ["overview", <SituationScreen key="s" />],
    ["orders", <ActionQueueScreen key="q" />],
    ["shelters", <SheltersScreen key="h" />],
    ["evidence", <ValidationScreen key="v" />],
  ])("%s renders with no axe violations", async (_name, node) => {
    const { container } = renderScreen(node);
    const results = await axe(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("overview states the gap instead of showing shelter zeros", () => {
    renderScreen(<SituationScreen />);
    expect(screen.getAllByText("No shelter register for this region").length).toBeGreaterThan(0);
    expect(screen.queryByText(/PEOPLE WITH NO SHELTER PLACE/)).toBeNull();
    expect(screen.queryByText(/SHELTERS IN THE FLOOD/)).toBeNull();
    expect(screen.getByText("Not scorable")).toBeTruthy();
  });

  it("shelters screen says there is no register and borrows none", () => {
    renderScreen(<SheltersScreen />);
    expect(screen.getByText("No shelter register for this region")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("evidence screen gives the reason the check is not scorable", () => {
    renderScreen(<ValidationScreen />);
    expect(screen.getByText(/Satellite check: not scorable/)).toBeTruthy();
    expect(screen.getByText(new RegExp(data.validationUnavailableReason?.slice(0, 30) ?? "x"))).toBeTruthy();
  });
});
