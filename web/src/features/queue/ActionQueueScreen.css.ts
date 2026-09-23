import { createVar, style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * Two-pane triage layout: the queue on the left, the selected order's
 * evidence on the right. Modelled on incident tooling and triage inboxes —
 * work down a list, with context kept beside each item.
 */

export const screen = style({
  display: "grid",
  gridTemplateColumns: "minmax(320px, 400px) 1fr",
  gap: vars.space[8],
  alignItems: "start",
  "@media": { "screen and (max-width: 1000px)": { gridTemplateColumns: "1fr" } },
});

// ------------------------------------------------------------------- list

export const list = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[6],
  position: "sticky",
  top: vars.space[6],
  "@media": { "screen and (max-width: 1000px)": { position: "static" } },
});

export const listHead = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

export const progressTrack = style({
  height: "4px",
  borderRadius: vars.radius.pill,
  background: vars.color.surface.sunken,
  overflow: "hidden",
});

/** Set with assignInlineVars: the fill width is data, not design. */
export const pctVar = createVar();

export const progressFill = style({
  width: pctVar,
  height: "100%",
  borderRadius: vars.radius.pill,
  background: vars.color.intent.success,
  transitionProperty: "width",
  transitionDuration: vars.duration.normal,
  transitionTimingFunction: vars.easing.standard,
});

export const progressMeta = style({
  display: "flex",
  justifyContent: "space-between",
  color: vars.color.text.muted,
});

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
});

export const groupTitle = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[2],
  paddingInline: vars.space[3],
  paddingBlockEnd: vars.space[1],
  color: vars.color.text.muted,
});

export const groupCount = style({ marginInlineStart: "auto" });

const itemBase = style({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: vars.space[3],
  alignItems: "start",
  width: "100%",
  textAlign: "start",
  paddingInline: vars.space[3],
  paddingBlock: vars.space[3],
  borderRadius: vars.radius.md,
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
  selectors: { "&:hover": { background: vars.color.surface.sunken } },
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: vars.duration.instant } },
});

export const item = styleVariants({
  default: [itemBase],
  selected: [
    itemBase,
    {
      background: vars.color.intent.infoSoft,
      boxShadow: `inset ${vars.stroke.outline} 0 0 0 ${vars.color.intent.info}`,
    },
  ],
  ordered: [itemBase, { opacity: 0.68 }],
});

/** The checkbox is the primary control: one tick records an order. */
export const check = style({
  width: "18px",
  height: "18px",
  marginBlockStart: "2px",
  accentColor: vars.color.intent.success,
  cursor: "pointer",
});

// The row's select target is a real <button>, beside (not around) the
// checkbox: nesting one control inside another breaks screen readers.
export const itemBody = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  minWidth: 0,
  flex: 1,
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "start",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  ":focus-visible": { outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}` },
});

export const itemTitle = style({ color: vars.color.text.primary });

export const itemTitleOrdered = style({
  color: vars.color.text.muted,
  textDecorationLine: "line-through",
  textDecorationColor: vars.color.border.strong,
});

export const itemMeta = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  flexWrap: "wrap",
  color: vars.color.text.muted,
});

export const deadline = styleVariants({
  due: { color: vars.color.text.secondary },
  soon: { color: vars.color.intent.warning, fontWeight: vars.weight.semibold },
  overdue: { color: vars.color.intent.danger, fontWeight: vars.weight.semibold },
  done: { color: vars.color.intent.success },
});

export const people = style({ color: vars.color.hazard.compromised, fontWeight: vars.weight.semibold });

// ----------------------------------------------------------------- detail

export const detail = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[6],
  minWidth: 0,
});

export const detailHead = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

export const kind = style({ color: vars.color.text.muted });

export const detailTitle = style({
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "24px",
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  lineHeight: "30px",
  fontWeight: vars.weight.semibold,
  letterSpacing: "-0.01em",
  color: vars.color.text.primary,
});

export const detailMeta = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[4],
  flexWrap: "wrap",
  color: vars.color.text.secondary,
});

export const metaItem = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
});

export const summary = style({
  color: vars.color.text.secondary,
  maxWidth: "62ch",
});

/** Evidence as a definition list: label, value, and its disclosure. */
export const evidence = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
  gap: vars.space[4],
  margin: vars.space[0],
});

export const evidenceItem = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  paddingBlock: vars.space[3],
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

export const evidenceLabel = style({ color: vars.color.text.muted });

export const evidenceValue = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[2],
  flexWrap: "wrap",
  color: vars.color.text.primary,
});

export const actionsRow = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[3],
  flexWrap: "wrap",
  paddingBlockStart: vars.space[2],
});

const buttonBase = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  fontWeight: vars.weight.semibold,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  transitionProperty: "background-color, border-color",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
});

export const primary = style([
  buttonBase,
  {
    background: vars.color.intent.info,
    borderColor: vars.color.intent.info,
    color: vars.color.text.inverse,
  },
]);

export const primaryDone = style([
  buttonBase,
  {
    background: vars.color.intent.successSoft,
    borderColor: vars.color.intent.success,
    color: vars.color.intent.success,
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

export const orderedNote = style({ color: vars.color.text.muted });

export const kbdHint = style({
  marginInlineStart: "auto",
  display: "inline-flex",
  gap: vars.space[2],
  color: vars.color.text.muted,
});

export const kbd = style({
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.surface.raised,
  fontFamily: vars.font.mono,
  // eslint-disable-next-line no-restricted-syntax -- one-off display size outside the text scale
  fontSize: "11px",
});

export const empty = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  paddingBlock: vars.space[12],
  alignItems: "flex-start",
  color: vars.color.text.secondary,
});
