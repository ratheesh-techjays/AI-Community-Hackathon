import { style } from "@vanilla-extract/css";

import { interactive, panel } from "@/design/effects.css";
import { vars } from "@/design/tokens/contract.css";

export const card = style([
  panel,
  interactive,
  {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: vars.space[2],
    padding: vars.space[4],
  },
]);

/**
 * A finding that demands an order. Border and number take hazard.compromised
 * and a ⚠ glyph sits before the number.
 * Guideline: never more than two flagged cards on a screen.
 */
export const flagged = style({
  borderColor: vars.color.hazard.compromised,
  borderWidth: vars.stroke.outline,
  selectors: {
    // A rule of the compromised colour across the top: a second channel
    // beyond the border, readable when the card is only skimmed.
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

export const value = style({ color: vars.color.text.primary });

export const valueFlagged = style({
  color: vars.color.hazard.compromised,
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
});

/** Units and "of 177"-style denominators. */
export const unit = style({ color: vars.color.text.secondary });

/** The external source this number sits beside — IMD, satellite truth, census. */
export const compare = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[2],
  flexWrap: "wrap",
  paddingBlockStart: vars.space[2],
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  color: vars.color.text.muted,
});

export const compareSource = style({ color: vars.color.text.secondary });
