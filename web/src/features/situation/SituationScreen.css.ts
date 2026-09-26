import { globalStyle, style } from "@vanilla-extract/css";

import { panel } from "@/design/effects.css";
import { vars } from "@/design/tokens/contract.css";

/** Which storm, which area, the verdict on trust, and the one next step. */
export const summary = style([
  panel,
  {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: vars.space[6],
    padding: vars.space[6],
    "@media": {
      "screen and (max-width: 860px)": {
        gridTemplateColumns: "1fr",
        gap: vars.space[4],
        padding: vars.space[4],
      },
    },
  },
]);

export const summaryText = style({ display: "flex", flexDirection: "column", gap: vars.space[2] });

export const eyebrow = style({ color: vars.color.text.muted });

export const summaryTitle = style({
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "26px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "32px",
  fontWeight: vars.weight.semibold,
  letterSpacing: "-0.015em",
  color: vars.color.text.primary,
});

export const summaryLead = style({ color: vars.color.text.secondary });

const trustBase = style({
  display: "flex",
  alignItems: "flex-start",
  gap: vars.space[2],
  marginBlockStart: vars.space[1],
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  maxWidth: "70ch",
});
globalStyle(`${trustBase} > svg`, { flexShrink: 0, marginBlockStart: vars.space[1] });

export const trustWarn = style([
  trustBase,
  { background: vars.color.disclosure.heuristicSoft, color: vars.color.text.primary },
]);

export const trustOk = style([
  trustBase,
  { background: vars.color.disclosure.validatedSoft, color: vars.color.text.primary },
]);

export const summaryActions = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: vars.space[2],
  minWidth: "14rem",
  "@media": { "screen and (max-width: 860px)": { minWidth: "0" } },
});

export const primary = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space[2],
  paddingInline: vars.space[6],
  paddingBlock: vars.space[3],
  borderRadius: vars.radius.md,
  background: vars.color.intent.info,
  color: vars.color.text.inverse,
  fontWeight: vars.weight.semibold,
  textDecoration: "none",
  transition: `filter ${vars.duration.fast} ${vars.easing.standard}`,
  selectors: { "&:hover": { filter: "brightness(1.08)" } },
});

export const actionNote = style({ color: vars.color.text.muted, textAlign: "center" });

export const secondaryLink = style({
  textAlign: "center",
  color: vars.color.intent.info,
  fontWeight: vars.weight.semibold,
  paddingBlock: vars.space[1],
});

export const define = style({ color: vars.color.text.secondary, maxWidth: "80ch" });
