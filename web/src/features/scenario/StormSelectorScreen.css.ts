import { globalStyle, style } from "@vanilla-extract/css";

import { interactive, panel } from "@/design/effects.css";
import { vars } from "@/design/tokens/contract.css";

export const screen = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[8],
  maxWidth: "72rem",
});

// --- hero -----------------------------------------------------------------

export const hero = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  paddingBlockEnd: vars.space[2],
});

export const heroTitle = style({
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "28px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "34px",
  fontWeight: vars.weight.semibold,
  letterSpacing: "-0.015em",
  color: vars.color.text.primary,
  maxWidth: "36ch",
  "@media": {
    "screen and (max-width: 560px)": {
      // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
      fontSize: "22px",
      // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
      lineHeight: "28px",
    },
  },
});

export const heroLead = style({ color: vars.color.text.secondary, maxWidth: "68ch" });

export const steps = style({
  listStyle: "none",
  margin: vars.space[0],
  padding: vars.space[0],
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: vars.space[3],
  marginBlockStart: vars.space[2],
  // Phones: three short chips in a row instead of three stacked cards.
  "@media": { "screen and (max-width: 720px)": { gap: vars.space[2] } },
});

export const step = style({
  display: "flex",
  alignItems: "flex-start",
  gap: vars.space[3],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  borderColor: vars.color.border.default,
  background: vars.color.surface.raised,
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
      gap: vars.space[1],
      padding: vars.space[2],
    },
  },
});

export const stepNo = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: vars.radius.sm,
  background: vars.color.intent.infoSoft,
  color: vars.color.intent.info,
});

export const stepNote = style({
  display: "block",
  color: vars.color.text.muted,
  "@media": { "screen and (max-width: 720px)": { display: "none" } },
});

// --- groups -----------------------------------------------------------------

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
});

export const groupTitle = style({ color: vars.color.text.muted });
export const groupNote = style({ color: vars.color.text.muted, maxWidth: "72ch" });

export const catalogueHead = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
});

export const grid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
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

export const cardPrimary = style([
  card,
  { borderColor: vars.color.intent.info, boxShadow: `inset 0 3px 0 ${vars.color.intent.info}` },
]);

export const cardHead = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space[3],
});

export const cardTitle = style({
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "18px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "24px",
  fontWeight: vars.weight.semibold,
  letterSpacing: "-0.01em",
  color: vars.color.text.primary,
});

export const cardYear = style({ color: vars.color.text.muted, fontWeight: vars.weight.regular });

export const cardMeta = style({ color: vars.color.text.muted });

export const startHere = style({
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  color: vars.color.intent.info,
  background: vars.color.intent.infoSoft,
  whiteSpace: "nowrap",
});

export const note = style({ color: vars.color.text.secondary });

export const cardActions = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[3],
  flexWrap: "wrap",
  marginBlockStart: "auto",
  paddingBlockStart: vars.space[1],
});

const buttonBase = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space[2],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  fontWeight: vars.weight.semibold,
  textDecoration: "none",
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  cursor: "pointer",
  alignSelf: "flex-start",
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

export const primarySmall = style([
  primary,
  { paddingInline: vars.space[3], paddingBlock: vars.space[1] },
]);

export const secondarySmall = style([
  secondary,
  { paddingInline: vars.space[3], paddingBlock: vars.space[1] },
]);

export const modelCell = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: vars.space[1],
  textAlign: "end",
});

export const error = style({ color: vars.color.intent.danger });

// --- catalogue ----------------------------------------------------------------

export const filters = style({
  display: "grid",
  gridTemplateColumns: "minmax(12rem, 2fr) minmax(9rem, 1fr) minmax(8rem, 1fr) auto",
  alignItems: "end",
  gap: vars.space[3],
  "@media": {
    "screen and (max-width: 900px)": { gridTemplateColumns: "1fr 1fr" },
    "screen and (max-width: 560px)": { gridTemplateColumns: "1fr" },
  },
});

export const field = style({ display: "flex", flexDirection: "column", gap: vars.space[1] });
export const fieldLabel = style({ color: vars.color.text.muted });

export const input = style({
  width: "100%",
  minHeight: "2.5rem",
  paddingInline: vars.space[3],
  borderRadius: vars.radius.md,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  borderColor: vars.color.border.strong,
  background: vars.color.surface.raised,
  color: vars.color.text.primary,
  font: "inherit",
});

export const check = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  minHeight: "2.5rem",
  color: vars.color.text.primary,
  cursor: "pointer",
});

export const count = style({ color: vars.color.text.muted });
export const empty = style({ color: vars.color.text.secondary, maxWidth: "64ch" });

export const list = style([
  panel,
  {
    listStyle: "none",
    margin: vars.space[0],
    padding: vars.space[0],
    overflow: "hidden",
  },
]);

export const row = style({
  display: "grid",
  gridTemplateColumns: "minmax(8rem, 1fr) minmax(12rem, 1.4fr) minmax(14rem, 2fr) 9rem",
  alignItems: "center",
  gap: vars.space[3],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[3],
  borderBlockEndWidth: vars.stroke.hair,
  borderBlockEndStyle: "solid",
  borderBlockEndColor: vars.color.border.default,
  selectors: { "&:last-child": { borderBlockEndWidth: "0" } },
  "@media": {
    "screen and (max-width: 900px)": {
      gridTemplateColumns: "1fr auto",
      rowGap: vars.space[1],
    },
  },
});

export const rowMuted = style([row, { background: vars.color.surface.base }]);

export const rowName = style({ display: "flex", alignItems: "baseline", gap: vars.space[2] });
export const rowYear = style({ color: vars.color.text.muted });
export const rowWhere = style({ display: "flex", flexDirection: "column" });

export const rowFlags = style({
  listStyle: "none",
  margin: vars.space[0],
  padding: vars.space[0],
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  "@media": { "screen and (max-width: 900px)": { gridColumn: "1 / -1" } },
});

export const rowAction = style({
  display: "flex",
  justifyContent: "flex-end",
  "@media": { "screen and (max-width: 900px)": { gridColumn: "2", gridRow: "1" } },
});

const flagBase = style({
  display: "flex",
  alignItems: "flex-start",
  gap: vars.space[2],
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "13px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "18px",
});
globalStyle(`${flagBase} > svg`, { flexShrink: 0, marginBlockStart: vars.space[1] });

export const flagOn = style([flagBase, { color: vars.color.text.primary }]);
export const flagOff = style([flagBase, { color: vars.color.text.muted }]);

// --- honesty ----------------------------------------------------------------

export const honesty = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  paddingBlockStart: vars.space[4],
  borderBlockStartWidth: vars.stroke.hair,
  borderBlockStartStyle: "solid",
  borderBlockStartColor: vars.color.border.default,
});

export const honestyGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: vars.space[6],
  "@media": { "screen and (max-width: 720px)": { gridTemplateColumns: "1fr", gap: vars.space[3] } },
});

export const honestyHead = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  marginBlockEnd: vars.space[1],
});
