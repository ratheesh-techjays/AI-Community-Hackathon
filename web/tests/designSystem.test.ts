import { describe, expect, it } from "vitest";

import { color, radius, space, textStyle } from "@/design/tokens/source";

/**
 * Guards on the design system transcription. These catch a bad edit to
 * `source.ts` that would silently break an accessibility or IMD contract.
 */
describe("design system tokens", () => {
  it("keeps IMD stage colours identical in both themes", () => {
    // These are IMD's own colour code, not ours to re-tint at night.
    for (const stage of Object.values(color.stage)) {
      expect(stage.light).toBe(stage.dark);
    }
  });

  it("keeps text.onDark white in both themes", () => {
    // stage.watch, stage.postLandfall and floodDeep stay dark at night,
    // so their text must stay white in both themes.
    expect(color.text.onDark.light).toBe("#ffffff");
    expect(color.text.onDark.dark).toBe("#ffffff");
  });

  it("holds flood bands steady across themes except the deep band", () => {
    expect(color.hazard.floodShallow.light).toBe(color.hazard.floodShallow.dark);
    expect(color.hazard.floodModerate.light).toBe(color.hazard.floodModerate.dark);
    // deep is lifted in dark so it separates from surface.sunken
    expect(color.hazard.floodDeep.light).not.toBe(color.hazard.floodDeep.dark);
  });

  it("gives every Odia style more leading than its English pair", () => {
    const px = (v: string): number => Number.parseFloat(v);
    expect(px(textStyle.bodyOd.lineHeight)).toBeGreaterThan(px(textStyle.body.lineHeight));
    expect(px(textStyle.labelOd.lineHeight)).toBeGreaterThan(px(textStyle.label.lineHeight));
    expect(px(textStyle.screenTitleOd.lineHeight)).toBeGreaterThan(
      px(textStyle.screenTitle.lineHeight),
    );
  });

  it("never applies letter-spacing to an Odia style", () => {
    // Odia has no uppercase and no letter-spacing.
    expect("letterSpacing" in textStyle.labelOd).toBe(false);
    expect("letterSpacing" in textStyle.bodyOd).toBe(false);
  });

  it("keeps corners nearly square", () => {
    // Rounded corners read as consumer software.
    expect(radius.sm).toBe("2px");
    expect(radius.md).toBe("4px");
  });

  it("uses a 4px spacing grid", () => {
    for (const [key, value] of Object.entries(space)) {
      if (key === "0") continue;
      expect(Number.parseFloat(value) % 4).toBe(0);
    }
  });
});
