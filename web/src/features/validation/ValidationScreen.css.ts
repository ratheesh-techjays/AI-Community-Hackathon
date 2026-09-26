import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

export const screen = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[4],
});

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

/** One strip of figures divided by hairlines, matching MetricStrip. */
export const metricRow = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  background: vars.color.surface.raised,
  borderRadius: vars.radius.md,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  overflow: "hidden",
  "@media": { "screen and (max-width: 720px)": { gridTemplateColumns: "repeat(2, 1fr)" } },
});

export const metricCard = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  padding: vars.space[4],
  borderInlineStart: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  selectors: { "&:first-child": { borderInlineStart: "none" } },
});

export const metricLabel = style({ color: vars.color.text.secondary });
export const metricValue = style({ color: vars.color.text.primary });
export const metricDefinition = style({ color: vars.color.text.secondary });
export const metricNote = style({ color: vars.color.text.muted });

export const mapRow = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: vars.space[3],
  "@media": { "screen and (max-width: 900px)": { gridTemplateColumns: "1fr" } },
});

export const mapFigure = style({
  margin: vars.space[0],
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
});

export const mapWell = style({
  position: "relative",
  borderRadius: vars.radius.md,
  background: vars.color.map.land,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
  padding: vars.space[2],
});

/**
 * Placeholder wells until deck.gl layers land. They carry the correct OUTLINE
 * treatment so the distinction is already right: predicted is a solid outline,
 * observed is dashed, and neither is ever filled with the agreement colour.
 * TODO(frontend): replace with deck.gl GeoJsonLayer + BitmapLayer.
 */
export const wellPredicted = style({
  position: "relative",
  borderRadius: vars.radius.md,
  overflow: "hidden",
  // Solid outline: the design system's treatment for PREDICTED extent.
  border: `${vars.stroke.outline} solid ${vars.color.hazard.predicted}`,
});

export const wellObserved = style({
  position: "relative",
  borderRadius: vars.radius.md,
  overflow: "hidden",
  // Dashed outline: the design system's treatment for OBSERVED truth.
  border: `${vars.stroke.outline} dashed ${vars.color.hazard.observedTruth}`,
});

export const wellTag = style({
  position: "absolute",
  insetBlockStart: vars.space[2],
  insetInlineStart: vars.space[2],
  zIndex: vars.z.float,
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  background: vars.color.surface.raised,
  color: vars.color.text.secondary,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

/** Stacked bands showing the three overlay classes with their patterns. */
export const overlayBand = style({
  height: vars.space[6],
  borderRadius: vars.radius.sm,
});

export const figCaption = style({ color: vars.color.text.muted });

export const twoUp = style({
  display: "grid",
  gridTemplateColumns: "1fr minmax(15rem, 0.7fr)",
  gap: vars.space[3],
  alignItems: "start",
  "@media": { "screen and (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" } },
});

/** No box: a heading and its table, like every other section. */
export const panel = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  minWidth: 0,
});

export const confusion = style({ borderCollapse: "collapse", width: "100%" });

export const confusionHead = style({
  paddingBlock: vars.space[2],
  paddingInline: vars.space[0],
  color: vars.color.text.secondary,
  fontWeight: vars.weight.regular,
  borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
});

export const confusionCell = style({
  textAlign: "end",
  paddingBlock: vars.space[2],
  borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  fontVariantNumeric: "tabular-nums",
  paddingInlineStart: vars.space[2],
});

/** A failure of the satellite truth, not of the model. */
export const classTruth = style({
  color: vars.color.intent.info,
  fontWeight: vars.weight.semibold,
});

export const classModel = style({
  color: vars.color.text.primary,
  fontWeight: vars.weight.semibold,
});

export const failures = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[2],
  margin: 0,
  paddingInlineStart: vars.space[6],
  color: vars.color.text.primary,
});
