import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const term = style({
  position: "relative",
  textDecorationLine: "underline",
  textDecorationStyle: "dotted",
  textUnderlineOffset: "3px",
  cursor: "help",
});

export const tip = style({
  selectors: {
    [`${term}:hover &, ${term}:focus &`]: { display: "block" },
  },
  position: "absolute",
  insetBlockStart: "calc(100% + 6px)",
  insetInlineStart: 0,
  zIndex: vars.z.popover,
  width: "max-content",
  maxWidth: "min(20rem, 80vw)",
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.strong}`,
  boxShadow: vars.shadow.popover,
  color: vars.color.text.primary,
  fontFamily: vars.font.sans,
  fontWeight: vars.weight.regular,
  // eslint-disable-next-line no-restricted-syntax -- matches text.caption; a tooltip inside any text style
  fontSize: "12px",
  // eslint-disable-next-line no-restricted-syntax -- matches text.caption
  lineHeight: "16px",
  letterSpacing: "normal",
  textTransform: "none",
  whiteSpace: "normal",
  textAlign: "start",
  // display, not visibility: a hidden tip must not widen the page on a phone.
  display: "none",
  pointerEvents: "none",
});

