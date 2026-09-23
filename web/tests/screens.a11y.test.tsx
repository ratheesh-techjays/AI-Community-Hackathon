import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
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

import bundleJson from "./fixtures/run-bundle.json";

// jsdom has no WebGL: stand the map in with its accessible label only.
vi.mock("@/map/ImpactMap", () => ({
  ImpactMap: ({ label, children }: { label: string; children?: JSX.Element }) => (
    <figure>
      <div role="img" aria-label={label} />
      {children}
    </figure>
  ),
}));

const data = toScenarioData(bundleJson as unknown as RunBundle);

function renderScreen(screen: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OrderLedgerProvider>
          <ScenarioProvider value={data}>{screen}</ScenarioProvider>
        </OrderLedgerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("screens render real engine output accessibly", () => {
  it.each([
    ["orders", <ActionQueueScreen key="q" />],
    ["map", <SituationScreen key="s" />],
    ["shelters", <SheltersScreen key="h" />],
    ["evidence", <ValidationScreen key="v" />],
  ])("%s has no axe violations", async (_name, screen) => {
    const { container } = renderScreen(screen);
    const results = await axe(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("the evidence screen states a failed validation instead of badging it validated", () => {
    const { getByText, queryByText } = renderScreen(<ValidationScreen />);
    if (data.validation && !data.validation.passed) {
      expect(getByText(/below the 0\.25 floor/)).toBeTruthy();
      expect(queryByText(/Extent validated/)).toBeNull();
    }
  });

  it("the orders screen shows the briefing's provenance", () => {
    const { getAllByText } = renderScreen(<ActionQueueScreen />);
    expect(getAllByText(/numbers\s+matched to engine output/).length).toBeGreaterThan(0);
  });
});
