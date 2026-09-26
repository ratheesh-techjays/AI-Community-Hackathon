import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { StormSummary } from "@/api/endpoints";
import { StormSelectorScreen } from "@/features/scenario/StormSelectorScreen";

const storm = (over: Partial<StormSummary>): StormSummary => ({
  sid: over.name ?? "X",
  name: "X",
  season: 2020,
  peak_wind_kt: 100,
  landfall_at: "2020-05-20T12:00:00Z",
  landfall_lat: 22.1,
  landfall_lon: 88.4,
  landfall_coast: "West Bengal",
  landfall_country: "India",
  landfall_wind_kt: 95,
  modellable: true,
  not_modellable_reason: null,
  sar_possible: true,
  no_sar_reason: null,
  has_ems_activation: false,
  note: null,
  precomputed_run: null,
  ...over,
});

const STORMS: StormSummary[] = [
  storm({ name: "YAAS", season: 2021, landfall_coast: "Odisha", precomputed_run: "yaas-2021-balasore" }),
  storm({ name: "AMPHAN", season: 2020 }),
  storm({ name: "FANI", season: 2019, landfall_coast: "Odisha", precomputed_run: "fani-2019-puri" }),
  storm({
    name: "MAHA",
    season: 2019,
    landfall_at: null,
    landfall_coast: null,
    modellable: false,
    not_modellable_reason: "Never made landfall in the best track.",
    sar_possible: false,
    no_sar_reason: "No landfall, so there is no flood to score.",
  }),
];

const create = vi.fn(() =>
  Promise.resolve({ run_id: "run-123", status: "QUEUED", params_hash: "h", cache_hit: false, poll_url: "" }),
);

vi.mock("@/api/endpoints", () => ({
  stormsApi: { list: () => Promise.resolve({ storms: STORMS, total: STORMS.length }) },
  scenariosApi: { create: (...args: unknown[]) => create(...(args as [])) },
}));

function renderSelector() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <StormSelectorScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("storm selector", () => {
  it("says what the product is and leads with Fani", async () => {
    const { container } = renderSelector();
    expect(screen.getByRole("heading", { level: 2, name: /orders a district must give/ })).toBeTruthy();
    const open = await screen.findAllByRole("link", { name: /^Open (Fani|Yaas)/ });
    expect(open[0]?.textContent).toMatch(/Fani/);
    expect(open[0]?.getAttribute("href")).toBe("/scenarios/fani-2019-puri/overview");
    const results = await axe(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("searches the catalogue by name and hides unmodellable storms by default", async () => {
    renderSelector();
    expect(await screen.findByText("3 of 4 storms")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "amph" } });
    expect(await screen.findByText("1 of 4 storms")).toBeTruthy();
    expect(screen.getByText("Amphan")).toBeTruthy();
  });

  it("shows why a storm cannot be modelled once the filter is off", async () => {
    renderSelector();
    await screen.findByText("3 of 4 storms");
    fireEvent.click(screen.getByRole("checkbox", { name: /Only storms PRAHARI can model/ }));
    const row = (await screen.findByText("Maha")).closest("li");
    expect(row).not.toBeNull();
    if (row) expect(within(row).getByText(/Never made landfall/)).toBeTruthy();
  });

  it("models a storm with an AOI drawn around its landfall", async () => {
    renderSelector();
    const row = (await screen.findByText("Amphan")).closest("li");
    expect(row).not.toBeNull();
    if (!row) return;
    fireEvent.click(within(row).getByRole("button", { name: "Model it" }));
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalled();
    });
    const body = (create.mock.calls[0] as unknown as [{ aoi_preset: string; run_validation: boolean }])[0];
    expect(body.aoi_preset).toBe("auto");
    expect(body.run_validation).toBe(true);
  });

  it("gives a way out of an empty search", async () => {
    renderSelector();
    await screen.findByText("3 of 4 storms");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(await screen.findByText(/No storm matches/)).toBeTruthy();
  });
});
