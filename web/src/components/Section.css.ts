import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * A section is a heading and its content, separated from the next by SPACE.
 * It is deliberately not a bordered panel -- nesting panels was the main
 * reason the console read as cluttered.
 */
export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
});

export const head = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[3],
  flexWrap: "wrap",
});

export const title = style({ color: vars.color.text.primary });

export const note = style({ color: vars.color.text.muted });

export const actions = style({ marginInlineStart: "auto" });
