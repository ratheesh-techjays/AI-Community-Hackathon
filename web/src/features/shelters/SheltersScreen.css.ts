import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const screen = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[4],
});

export const header = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space[4],
  flexWrap: "wrap",
});

export const titleOdia = style({ color: vars.color.text.secondary });

export const clock = style({ color: vars.color.text.muted });

/** Two flagged cards and the legend. Never more than two flags on a screen. */
export const statRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr minmax(15rem, 0.8fr)",
  gap: vars.space[3],
  alignItems: "start",
  "@media": {
    "screen and (max-width: 1024px)": { gridTemplateColumns: "1fr 1fr" },
    "screen and (max-width: 560px)": { gridTemplateColumns: "1fr" },
  },
});

export const filterBar = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  flexWrap: "wrap",
});

export const filterLabel = style({ color: vars.color.text.secondary });

const filterBase = style({
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.sm,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  fontWeight: vars.weight.semibold,
});

export const filterOn = style([
  filterBase,
  {
    background: vars.color.intent.infoSoft,
    borderColor: vars.color.intent.info,
    color: vars.color.intent.info,
  },
]);

export const filterOff = style([
  filterBase,
  {
    background: vars.color.surface.raised,
    borderColor: vars.color.border.strong,
    color: vars.color.text.secondary,
  },
]);

export const exportButton = style([
  filterBase,
  {
    marginInlineStart: "auto",
    background: vars.color.surface.raised,
    borderColor: vars.color.border.strong,
    color: vars.color.text.primary,
  },
]);

/** An identifier so a row can be quoted verbatim in an order. */
export const subLine = style({ display: "block", color: vars.color.text.muted });

/** The register carries no name. We show the id and say so. */
export const unnamed = style({ color: vars.color.text.muted, fontStyle: "italic" });

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});
