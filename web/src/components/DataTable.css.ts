import { style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * A table, not a table inside a card.
 *
 * The previous version wrapped every table in a bordered panel, which stacked
 * a border inside a border inside a section. Here the table IS the surface:
 * a quiet header row, hairline row rules, and nothing around the outside.
 */

export const wrap = style({ width: "100%", overflowX: "auto" });

export const table = style({ borderCollapse: "collapse", width: "100%" });

/** The caption carries the count and the sort. Kept, but as plain text. */
export const caption = style({
  captionSide: "top",
  textAlign: "start",
  paddingBlockEnd: vars.space[2],
  color: vars.color.text.muted,
});

export const thead = style({
  position: "sticky",
  top: 0,
  zIndex: vars.z.panel,
  background: vars.color.surface.base,
});

export const th = style({
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  color: vars.color.text.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  verticalAlign: "bottom",
  selectors: {
    "&:first-child": { paddingInlineStart: vars.space[0] },
    "&:last-child": { paddingInlineEnd: vars.space[0] },
  },
});

/** Numbers right, text left. Never the other way round. */
export const thNumeric = style({ textAlign: "end" });

export const td = style({
  paddingBlock: vars.space[3],
  paddingInline: vars.space[3],
  borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  verticalAlign: "top",
  selectors: {
    "&:first-child": { paddingInlineStart: vars.space[0] },
    "&:last-child": { paddingInlineEnd: vars.space[0] },
  },
});

export const tdNumeric = style({
  textAlign: "end",
  fontFamily: vars.font.mono,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

/** An identifier so a row can be quoted verbatim in an order. */
export const subLine = style({ color: vars.color.text.muted, display: "block" });

/**
 * Row states. Only one per row; compromised wins. A left rule and a tint,
 * with no box around the table to compete with them.
 */
export const row = styleVariants({
  default: {},
  compromised: {
    background: vars.color.hazard.compromisedSoft,
    boxShadow: `inset 3px 0 0 0 ${vars.color.hazard.compromised}`,
  },
  unreached: {
    background: vars.color.intent.warningSoft,
    boxShadow: `inset 3px 0 0 0 ${vars.color.intent.warning}`,
  },
  watch: {},
  safe: {},
  selected: {
    background: vars.color.intent.infoSoft,
    boxShadow: `inset ${vars.stroke.outline} 0 0 0 ${vars.color.intent.info}`,
  },
});

const tagBase = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: "600",
  whiteSpace: "nowrap",
});

/** Tags are now ink-only: a glyph and a word, no pill border. */
export const tag = styleVariants({
  compromised: [tagBase, { color: vars.color.hazard.compromised }],
  unreached: [tagBase, { color: vars.color.intent.warning }],
  watch: [tagBase, { color: vars.color.text.muted }],
  safe: [tagBase, { color: vars.color.intent.success }],
});

export const orderCell = style({ width: "1%", whiteSpace: "nowrap" });

export const orderLabel = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
  cursor: "pointer",
});

export const orderedAt = style({ color: vars.color.text.muted, display: "block" });

export const empty = style({
  paddingBlock: vars.space[8],
  color: vars.color.text.muted,
  textAlign: "center",
});
