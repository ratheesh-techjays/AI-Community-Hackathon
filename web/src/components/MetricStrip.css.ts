import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * A horizontal band of figures, separated by thin rules rather than wrapped in
 * cards. Eight bordered cards in a grid reads as clutter; one calm strip reads
 * as a readout.
 */
export const strip = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
  gap: vars.space[0],
  background: vars.color.surface.raised,
  borderRadius: vars.radius.md,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  overflow: "hidden",
});

export const item = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  padding: vars.space[4],
  position: "relative",
  // A hairline between figures instead of a border around each one.
  borderInlineStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  selectors: { "&:first-child": { borderInlineStart: "none" } },
});

/** A figure that demands an order: a rule above it, and the value tinted. */
export const itemFlagged = style({
  selectors: {
    "&::before": {
      content: "",
      position: "absolute",
      insetBlockStart: 0,
      insetInline: 0,
      height: "3px",
      background: vars.color.hazard.compromised,
    },
  },
});

export const label = style({ color: vars.color.text.secondary });

export const valueRow = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[2],
  flexWrap: "wrap",
});

export const value = style({
  color: vars.color.text.primary,
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "28px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "32px",
  fontWeight: vars.weight.semibold,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
});

export const valueFlagged = style({ color: vars.color.hazard.compromised });

export const unit = style({ color: vars.color.text.secondary });

export const compare = style({ color: vars.color.text.muted });
