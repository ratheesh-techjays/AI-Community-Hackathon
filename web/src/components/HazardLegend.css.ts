import { style } from "@vanilla-extract/css";

import { glassPanel } from "@/design/effects.css";
import { vars } from "@/design/tokens/contract.css";

export const legend = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

/**
 * Floating over the map earns the one shadow in the system.
 * Positioned bottom-right so it never covers the landfall point.
 */
/**
 * Floating over the map is the ONE place glass is correct: letting the
 * cartography read through the legend is genuinely useful. `glassPanel`
 * ships a solid fallback and a visible border so it stays legible over
 * any basemap colour.
 */
export const floating = style([
  glassPanel,
  {
    position: "absolute",
    insetBlockEnd: vars.space[3],
    insetInlineEnd: vars.space[3],
    zIndex: vars.z.float,
    maxWidth: "17rem",
  },
]);

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
});

export const groupTitle = style({
  margin: vars.space[0],
  color: vars.color.text.secondary,
});

export const item = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
});

export const odia = style({ color: vars.color.text.muted });

export const threshold = style({ marginInlineStart: "auto", color: vars.color.text.muted });

export const footnote = style({
  margin: vars.space[0],
  paddingBlockStart: vars.space[2],
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  color: vars.color.text.muted,
});

const pinBase = style({
  width: "14px",
  height: "14px",
  borderRadius: vars.radius.pill,
  borderWidth: vars.stroke.outline,
  borderStyle: "solid",
  flexShrink: 0,
});

export const pinCompromised = style([
  pinBase,
  {
    background: vars.color.hazard.compromised,
    borderColor: vars.color.hazard.compromised,
    // Halo so a compromised pin reads at projector distance.
    boxShadow: `0 0 0 3px ${vars.color.hazard.compromisedSoft}`,
  },
]);

export const pinSafe = style([
  pinBase,
  { background: vars.color.surface.raised, borderColor: vars.color.intent.success },
]);

export const pinHospital = style([
  pinBase,
  { background: vars.color.surface.raised, borderColor: vars.color.intent.info, borderRadius: vars.radius.sm },
]);
