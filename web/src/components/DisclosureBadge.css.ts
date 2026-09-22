import { style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * Mono caps, a glyph, a hairline — the badge should read as a UNIT, not an
 * alarm. The heuristic amber is deliberately not the danger red: a heuristic
 * is a known limitation, not an emergency.
 */

export const wrapper = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "baseline",
  gap: vars.space[1],
});

const base = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  fontFamily: vars.font.mono,
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "500",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
});

/** Larger variant for table column headers, per the component guidelines. */
export const large = style({ fontSize: "12px", paddingInline: vars.space[3] });

export const badge = styleVariants({
  heuristic: [
    base,
    {
      color: vars.color.disclosure.heuristic,
      background: vars.color.disclosure.heuristicSoft,
      borderColor: vars.color.disclosure.heuristic,
    },
  ],
  modelled: [
    base,
    {
      color: vars.color.disclosure.modelled,
      background: vars.color.disclosure.modelledSoft,
      borderColor: vars.color.disclosure.modelled,
    },
  ],
  validated: [
    base,
    {
      color: vars.color.disclosure.validated,
      background: vars.color.disclosure.validatedSoft,
      borderColor: vars.color.disclosure.validated,
    },
  ],
  fallback: [
    base,
    {
      color: vars.color.disclosure.fallback,
      background: vars.color.disclosure.fallbackSoft,
      borderColor: vars.color.disclosure.fallback,
    },
  ],
});

/** Floats over content, so it earns the one shadow. */
export const popover = style({
  position: "absolute",
  top: `calc(100% + ${vars.space[2]})`,
  left: vars.space[0],
  zIndex: vars.z.popover,
  width: "min(30rem, 78vw)",
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  boxShadow: vars.shadow.popover,
  textAlign: "start",
  textTransform: "none",
  letterSpacing: "normal",
});

export const row = style({
  display: "grid",
  gridTemplateColumns: "7.5rem 1fr",
  gap: vars.space[3],
  paddingBlock: vars.space[2],
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  selectors: { "&:first-of-type": { borderBlockStart: "none" } },
});

export const rowLabel = style({
  color: vars.color.text.secondary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

/** IMD's own figure sits beside ours, never hidden. */
export const imdRow = style({
  marginBlockStart: vars.space[3],
  padding: vars.space[3],
  borderRadius: vars.radius.sm,
  background: vars.color.surface.sunken,
  color: vars.color.text.primary,
});

export const notCaptured = style({
  margin: vars.space[0],
  paddingInlineStart: vars.space[4],
  color: vars.color.text.secondary,
});

export const provenance = style({
  display: "inline-block",
  marginBlockStart: vars.space[3],
  color: vars.color.intent.info,
});
