import { describe, expect, it } from "vitest";

import { toScenarioData, type RunBundle } from "@/features/scenario/adapter";

import bundleJson from "./fixtures/run-bundle.json";

/**
 * The adapter only renames and joins: every number on screen must be a number
 * the engine returned. The fixture is a trimmed snapshot of the real Fani run
 * (scripts/snapshot-bundle.mjs), so these tests exercise real shapes.
 */

const bundle = bundleJson as unknown as RunBundle;

function clone(): RunBundle {
  return structuredClone(bundle);
}

describe("toScenarioData", () => {
  it("copies headline numbers from the engine summary unchanged", () => {
    const data = toScenarioData(bundle);
    const s = bundle.detail.summary;
    expect(s).toBeTruthy();
    if (!s) return;
    expect(data.headline.populationAtRisk).toBe(s.population_at_risk);
    expect(data.headline.buildingsAtRisk).toBe(s.buildings_at_risk);
    expect(data.headline.sheltersCompromised).toBe(s.shelters_compromised);
    expect(data.headline.unassignedPopulation).toBe(s.unassigned_population);
  });

  it("never marks a run validated unless the backend attached validated_against", () => {
    const failed = clone();
    if (failed.detail.summary) failed.detail.summary.disclosure.validated_against = null;
    expect(toScenarioData(failed).meta.validated).toBe(false);
    expect(toScenarioData(failed).validation?.passed).toBe(false);

    const passed = clone();
    if (passed.detail.summary) passed.detail.summary.disclosure.validated_against = "sentinel1_test";
    expect(toScenarioData(passed).meta.validated).toBe(true);
  });

  it("carries the server's own limitations into every disclosure badge", () => {
    const data = toScenarioData(bundle);
    expect(data.limitations.surge.notCaptured).toEqual(bundle.hazard.disclosure.limitations);
    expect(data.limitations.reachability.notCaptured).toEqual(bundle.decisions.disclosure.limitations);
    expect(data.limitations.parametric.notCaptured).toEqual(bundle.parametric.disclosure.limitations);
  });

  it("names shelters only from the register", () => {
    const data = toScenarioData(bundle);
    const register = new Map(bundle.assets.shelters.map((s) => [s.register_id, s.name]));
    for (const s of data.shelters) expect(register.get(s.osdmaId)).toBe(s.name);
  });

  it("labels at most ten shelters on the map, all compromised", () => {
    const labelled = toScenarioData(bundle).map.shelters.filter((s) => s.labelled);
    expect(labelled.length).toBeLessThanOrEqual(10);
    expect(labelled.every((s) => s.status === "compromised")).toBe(true);
  });

  it("drops blocks with nothing at risk", () => {
    const data = toScenarioData(bundle);
    expect(data.blocks.every((b) => b.populationAtRisk > 0 || b.sheltersCompromised > 0)).toBe(true);
  });

  it("marks IMD issue times as unknown rather than skipped", () => {
    expect(toScenarioData(bundle).stages.every((s) => s.issueUnknown && s.issuedAtHours === null)).toBe(true);
  });

  it("keeps an action's evidence and disclosure state from the engine", () => {
    const data = toScenarioData(bundle);
    const first = bundle.decisions.actions[0];
    const action = data.actions.find((a) => a.id === first?.subject_id);
    expect(action?.evidence.map((e) => e.state)).toEqual(first?.evidence.map((e) => e.state));
  });
});
