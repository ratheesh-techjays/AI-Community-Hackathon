import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const panel = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.surface.raised,
  boxShadow: vars.shadow.rest,
});

export const form = style({ display: "flex", flexDirection: "column", gap: vars.space[2] });

export const kicker = style({ color: vars.color.text.secondary });

export const row = style({ display: "flex", gap: vars.space[2], flexWrap: "wrap" });

export const input = style({
  flex: "1 1 240px",
  minWidth: 0,
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.sm,
  border: `${vars.stroke.hair} solid ${vars.color.border.strong}`,
  background: vars.color.surface.base,
  color: vars.color.text.primary,
  font: "inherit",
  ":focus-visible": { outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}` },
});

export const submit = style({
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.sm,
  border: "none",
  background: vars.color.intent.info,
  color: vars.color.text.inverse,
  fontWeight: vars.weight.semibold,
  cursor: "pointer",
  ":disabled": { opacity: 0.55, cursor: "not-allowed" },
  ":focus-visible": { outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}` },
});

export const examples = style({ display: "flex", gap: vars.space[2], flexWrap: "wrap" });

export const example = style({
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.pill,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.surface.sunken,
  color: vars.color.text.secondary,
  font: "inherit",
  cursor: "pointer",
  ":focus-visible": { outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}` },
});

export const answer = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  paddingBlockStart: vars.space[2],
  borderBlockStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

export const meta = style({ color: vars.color.text.secondary });

export const error = style({ color: vars.color.intent.danger });
