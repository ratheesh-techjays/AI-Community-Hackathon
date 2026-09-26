import { globalStyle, style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * Map frame styling. Every colour reads from a token, so the map and the
 * legend cannot drift and a theme swap reaches the cartography too.
 */

export const frame = style({
  position: "relative",
  margin: 0,
  borderRadius: vars.radius.md,
  overflow: "hidden",
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.map.water,
  boxShadow: vars.shadow.rest,
  width: "100%",
  aspectRatio: "16 / 10",
  "@media": { "screen and (max-width: 720px)": { aspectRatio: "4 / 5" } },
});

export const canvasWrap = style({ position: "absolute", inset: 0 });

// MapLibre's own CSS sets .maplibregl-map { position: relative }, which beats
// an absolute inset; an explicit 100% size survives it.
export const canvas = style({ position: "absolute", inset: 0, width: "100%", height: "100%" });

export const overlay = style({
  position: "absolute",
  right: vars.space[3],
  bottom: vars.space[6],
  zIndex: vars.z.float,
  maxWidth: "calc(100% - 24px)",
  // MapLibre's attribution wraps to two lines on a phone; sit above it.
  "@media": { "screen and (max-width: 720px)": { bottom: vars.space[12] } },
});

export const caption = style({
  position: "absolute",
  left: vars.space[3],
  bottom: vars.space[2],
  zIndex: vars.z.float,
  paddingInline: vars.space[2],
  borderRadius: vars.radius.sm,
  background: vars.color.surface.raised,
  color: vars.color.text.secondary,
});

export const mapError = style({
  position: "absolute",
  left: vars.space[3],
  top: vars.space[3],
  padding: vars.space[2],
  borderRadius: vars.radius.sm,
  background: vars.color.intent.warningSoft,
  color: vars.color.text.primary,
});

// MapLibre's own controls inherit the app font.
globalStyle(`${frame} .maplibregl-ctrl-attrib`, { fontFamily: vars.font.sans });
