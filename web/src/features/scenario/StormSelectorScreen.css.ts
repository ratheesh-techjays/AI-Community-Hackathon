import { style } from "@vanilla-extract/css";

import { interactive, panel } from "@/design/effects.css";
import { vars } from "@/design/tokens/contract.css";

export const screen = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[8],
});

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
});

export const groupTitle = style({ color: vars.color.text.muted });
export const groupNote = style({ color: vars.color.text.muted, maxWidth: "64ch" });

export const grid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(20rem, 1fr))",
  gap: vars.space[4],
});

/** The one place cards are right: each storm is a discrete thing to pick. */
export const card = style([
  panel,
  interactive,
  {
    display: "flex",
    flexDirection: "column",
    gap: vars.space[3],
    padding: vars.space[4],
  },
]);

export const cardHead = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space[3],
});

export const cardTitle = style({
  fontSize: "18px",
  lineHeight: "24px",
  fontWeight: "600",
  letterSpacing: "-0.01em",
  color: vars.color.text.primary,
});

export const cardMeta = style({ color: vars.color.text.muted });

export const pillValidated = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  color: vars.color.disclosure.validated,
  background: vars.color.disclosure.validatedSoft,
  whiteSpace: "nowrap",
});

export const flags = style({
  listStyle: "none",
  margin: vars.space[0],
  padding: vars.space[0],
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
});

const flagBase = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  fontSize: "13px",
  lineHeight: "18px",
});

export const flagOn = style([flagBase, { color: vars.color.text.primary }]);
export const flagOff = style([flagBase, { color: vars.color.text.muted }]);

export const note = style({ color: vars.color.text.secondary });

export const cardActions = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[3],
  flexWrap: "wrap",
  marginBlockStart: "auto",
  paddingBlockStart: vars.space[2],
});

const buttonBase = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  fontWeight: "600",
  textDecoration: "none",
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  selectors: { "&:disabled": { opacity: 0.6, cursor: "default" } },
});

export const primary = style([
  buttonBase,
  {
    background: vars.color.intent.info,
    borderColor: vars.color.intent.info,
    color: vars.color.text.inverse,
  },
]);

export const secondary = style([
  buttonBase,
  {
    background: vars.color.surface.raised,
    borderColor: vars.color.border.strong,
    color: vars.color.text.primary,
  },
]);

export const accepted = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  color: vars.color.intent.success,
});

export const error = style({ color: vars.color.intent.danger });

export const foot = style({ color: vars.color.text.muted, maxWidth: "72ch" });
