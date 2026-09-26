import { describe, expect, it } from "vitest";

import { groupDigits } from "@/features/queue/Briefing";

describe("groupDigits", () => {
  it("groups bare counts the Indian way and leaves ids, years and decimals alone", () => {
    expect(groupDigits("placing 470801 population and 19226 buildings")).toBe(
      "placing 4,70,801 population and 19,226 buildings",
    );
    expect(groupDigits("OSDMA-08461 in 2019 at 782.2 km2, 12345.6 m")).toBe(
      "OSDMA-08461 in 2019 at 782.2 km2, 12345.6 m",
    );
    expect(groupDigits("already 3,50,318 people")).toBe("already 3,50,318 people");
  });
});
