import { describe, expect, it, vi } from "vitest";

import { disclose, disclosureVariant, unsafeUnwrap } from "@/types/disclosed";

describe("Disclosed<T> (principle F1)", () => {
  const heuristic = disclose(3.2, {
    model_class: "heuristic_index",
    limitations: ["calibrated heuristic index, not a validated forecast model"],
  });

  it("carries the value and its disclosure together", () => {
    expect(heuristic.value).toBe(3.2);
    expect(heuristic.disclosure.limitations).toHaveLength(1);
  });

  it("classifies a heuristic as heuristic", () => {
    expect(disclosureVariant(heuristic.disclosure)).toBe("heuristic");
  });

  it("promotes a validated model over its base class", () => {
    const validated = disclose(0.38, {
      model_class: "parametric_physical",
      limitations: ["bathtub approximation"],
      validated_against: "sentinel1_sar_fani_2019",
      skill_metric: { csi: 0.38 },
    });
    expect(disclosureVariant(validated.disclosure)).toBe("validated");
  });

  it("warns loudly when unwrapped without a badge", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(unsafeUnwrap(heuristic, "csv export")).toBe(3.2);
    warn.mockRestore();
  });
});
