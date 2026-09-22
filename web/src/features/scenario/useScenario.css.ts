import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const empty = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: vars.space[3],
  paddingBlock: vars.space[12],
  maxWidth: "56ch",
  color: vars.color.text.secondary,
});

export const emptyBody = style({ color: vars.color.text.secondary });

export const emptyLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  border: `${vars.stroke.hair} solid ${vars.color.border.strong}`,
  color: vars.color.text.primary,
  textDecoration: "none",
  fontWeight: "600",
});
