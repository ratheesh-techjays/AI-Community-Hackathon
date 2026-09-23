import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const panel = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  background: vars.color.surface.sunken,
  color: vars.color.text.primary,
});

export const head = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[3],
  flexWrap: "wrap",
});

export const kicker = style({ margin: 0, color: vars.color.text.secondary });

export const toggle = style({ display: "inline-flex", gap: vars.space[1] });

const langBase = style({
  paddingInline: vars.space[3],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  border: `${vars.stroke.hair} solid ${vars.color.border.strong}`,
  cursor: "pointer",
  fontFamily: vars.font.odia,
  ":focus-visible": { outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}` },
});

export const langOn = style([
  langBase,
  { background: vars.color.intent.infoSoft, borderColor: vars.color.intent.info, color: vars.color.intent.info },
]);

export const langOff = style([
  langBase,
  { background: vars.color.surface.raised, color: vars.color.text.secondary },
]);

export const notice = style({ color: vars.color.intent.warning });

export const source = style({ color: vars.color.text.secondary });

export const caveats = style({
  margin: 0,
  paddingInlineStart: vars.space[4],
  color: vars.color.text.muted,
});
