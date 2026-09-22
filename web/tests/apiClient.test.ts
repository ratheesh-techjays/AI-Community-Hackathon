import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";

describe("ApiError retry policy", () => {
  const make = (status: number, type: string): ApiError =>
    new ApiError({ status, type, title: "t", requestId: "r" });

  it("retries transport failures", () => {
    expect(make(503, "about:blank").isRetriable).toBe(true);
    expect(make(429, "about:blank").isRetriable).toBe(true);
  });

  it("NEVER retries a hazard model failure", () => {
    // The science failed, not the network. Retrying masks a real failure.
    const err = make(500, "https://prahari.dev/problems/hazard-model-error");
    expect(err.isHazardModelError).toBe(true);
    expect(err.isRetriable).toBe(false);
  });

  it("does not retry client errors", () => {
    expect(make(404, "https://prahari.dev/problems/run-not-found").isRetriable).toBe(false);
  });

  it("recognises truth-unavailable so the UI can explain it", () => {
    const err = make(424, "https://prahari.dev/problems/truth-unavailable");
    expect(err.isTruthUnavailable).toBe(true);
    expect(err.i18nKey).toBe("errors.truthUnavailable");
  });

  it("falls back to a generic i18n key for unknown problems", () => {
    expect(make(500, "about:blank").i18nKey).toBe("errors.unexpected");
  });
});
