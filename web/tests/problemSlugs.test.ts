import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PROBLEM_I18N } from "@/api/errors";

/**
 * The backend's problem slugs and this map must stay in sync (root CLAUDE.md).
 * Read the slugs straight from backend/prahari/api/errors.py.
 */
describe("problem+json slugs", () => {
  it("maps every PrahariError slug the backend can raise", () => {
    const source = readFileSync(resolve(__dirname, "../../backend/prahari/api/errors.py"), "utf-8");
    const slugs = [...source.matchAll(/slug, title, status = "([a-z-]+)"/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(8);
    const missing = slugs.filter((slug) => !(`https://prahari.dev/problems/${slug ?? ""}` in PROBLEM_I18N));
    expect(missing).toEqual([]);
  });
});
