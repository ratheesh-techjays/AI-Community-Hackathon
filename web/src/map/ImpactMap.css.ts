import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * Map styling. Every fill and stroke reads from a token, so the map and the
 * legend cannot drift and a theme swap reaches the cartography too.
 */

export const frame = style({
  position: "relative",
  borderRadius: vars.radius.md,
  overflow: "hidden",
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.map.water,
  boxShadow: vars.shadow.rest,
});

export const svg = style({
  display: "block",
  width: "100%",
  aspectRatio: "16 / 10",
});

export const sea = style({ fill: vars.color.map.water });
export const land = style({ fill: vars.color.map.land });

export const coastline = style({
  fill: "none",
  stroke: vars.color.border.strong,
  strokeWidth: vars.stroke.hair,
});

/** Pattern ink: dark enough to read on any band, in both themes. */
export const patternInk = style({ fill: vars.color.text.primary, opacity: 0.35 });
export const patternStroke = style({ stroke: vars.color.text.primary, opacity: 0.3 });

export const floodShallow = style({ fill: vars.color.hazard.floodShallow, opacity: 0.85 });
export const floodModerate = style({ fill: vars.color.hazard.floodModerate, opacity: 0.85 });
export const floodDeep = style({ fill: vars.color.hazard.floodDeep, opacity: 0.9 });

/** Wind is OUTLINE only, stroke grows with class — never confusable with water. */
export const windGroup = style({ fill: "none" });

export const windLow = style({
  stroke: vars.color.hazard.windLow,
  strokeWidth: vars.stroke.wind,
  opacity: 0.85,
});

export const windModerate = style({
  stroke: vars.color.hazard.windModerate,
  strokeWidth: vars.stroke.wind,
  opacity: 0.85,
});

export const windSevere = style({
  stroke: vars.color.hazard.windSevere,
  strokeWidth: vars.stroke.windSevere,
  opacity: 0.9,
});

export const track = style({
  fill: "none",
  stroke: vars.color.text.primary,
  strokeWidth: vars.stroke.outline,
  strokeDasharray: "6 4",
  strokeLinecap: "round",
});

export const landfallPoint = style({
  fill: vars.color.text.primary,
  stroke: vars.color.surface.raised,
  strokeWidth: vars.stroke.outline,
});

export const landfallLabel = style({
  fill: vars.color.text.primary,
  fontFamily: vars.font.mono,
  fontSize: "10px",
  fontWeight: "500",
});

/** Halo so a compromised pin reads at projector distance. */
export const pinHalo = style({ fill: vars.color.hazard.compromisedSoft, opacity: 0.9 });

export const pinCompromised = style({
  fill: vars.color.hazard.compromised,
  stroke: vars.color.surface.raised,
  strokeWidth: "1.2px",
});

export const pinSafe = style({
  fill: vars.color.surface.raised,
  stroke: vars.color.intent.success,
  strokeWidth: vars.stroke.outline,
});

export const pinHospital = style({
  fill: vars.color.surface.raised,
  stroke: vars.color.intent.info,
  strokeWidth: vars.stroke.outline,
});

export const pinLabel = style({
  fill: vars.color.text.primary,
  fontFamily: vars.font.sans,
  fontSize: "10px",
  fontWeight: "600",
  paintOrder: "stroke",
  stroke: vars.color.surface.raised,
  strokeWidth: "3px",
  strokeLinejoin: "round",
});

export const disclaimer = style({
  position: "absolute",
  insetBlockEnd: vars.space[0],
  insetInline: vars.space[0],
  padding: vars.space[2],
  background: vars.color.surface.raised,
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  color: vars.color.text.muted,
  margin: vars.space[0],
});

/** Focus ring for the selected order's location. Static — never pulses. */
export const focusRing = style({
  fill: "none",
  stroke: vars.color.intent.info,
  strokeWidth: vars.stroke.outline,
  strokeDasharray: "4 3",
});

export const focusDot = style({ fill: vars.color.intent.info });

export const focusLabel = style({
  fill: vars.color.intent.info,
  fontFamily: vars.font.sans,
  fontSize: "11px",
  fontWeight: "600",
  paintOrder: "stroke",
  stroke: vars.color.surface.raised,
  strokeWidth: "3px",
  strokeLinejoin: "round",
});
