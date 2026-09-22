import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const screen = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[4],
});

export const titleOdia = style({ color: vars.color.text.secondary });

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

/**
 * Map two thirds, summary one third on a 1280 console.
 * On a tablet the summary moves under the map and the table stays last.
 */
export const workArea = style({
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: vars.space[4],
  alignItems: "start",
  "@media": { "screen and (max-width: 1024px)": { gridTemplateColumns: "1fr" } },
});

export const mapColumn = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

export const summaryColumn = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
});

/** Two cards per row in the narrow summary column. */
export const statGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: vars.space[3],
  "@media": { "screen and (max-width: 560px)": { gridTemplateColumns: "1fr" } },
});
