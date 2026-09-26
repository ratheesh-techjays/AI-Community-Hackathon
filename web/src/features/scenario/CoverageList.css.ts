import { globalStyle, style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const list = style({
  listStyle: "none",
  margin: vars.space[0],
  padding: vars.space[0],
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[2],
});

const base = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
});
globalStyle(`${base} > svg`, { flexShrink: 0 });

export const item = styleVariants({
  on: [base, { borderColor: vars.color.border.default, color: vars.color.text.primary }],
  part: [
    base,
    {
      borderColor: vars.color.disclosure.heuristic,
      background: vars.color.disclosure.heuristicSoft,
      color: vars.color.text.primary,
    },
  ],
  off: [
    base,
    { borderColor: vars.color.border.strong, background: vars.color.surface.sunken, color: vars.color.text.primary },
  ],
});

export const label = style({ color: vars.color.text.muted });
