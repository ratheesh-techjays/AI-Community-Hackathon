import { createVar, style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const wVar = createVar();
export const hVar = createVar();

export const block = style({
  display: "block",
  width: wVar,
  height: hVar,
});

export const rounded = style({ borderRadius: vars.radius.pill });

export const card = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

export const table = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});
