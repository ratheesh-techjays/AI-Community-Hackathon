import { createVar, style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * Dynamic positions along the track.
 *
 * A timeline position is data, not design: it depends on when a bulletin was
 * actually issued. These CSS custom properties are the sanctioned way to let
 * a runtime value reach CSS -- set with `assignInlineVars`, which emits ONLY
 * custom properties and never a hardcoded style declaration.
 */
export const posVar = createVar();
export const leftVar = createVar();
export const widthVar = createVar();

/** No panel: the timeline sits directly on the page, like a ruler. */
export const wrapper = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
});

export const track = style({
  position: "relative",
  height: "6px",
  marginBlockStart: vars.space[6],
  borderRadius: vars.radius.pill,
  background: vars.color.surface.sunken,
});

/** A window whose nominal time passed with no bulletin. Must keep full width. */
export const skippedSegment = style({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: leftVar,
  width: widthVar,
  background: vars.color.intent.dangerSoft,
  backgroundImage: `repeating-linear-gradient(45deg, ${vars.color.intent.danger} 0 1px, transparent 1px 6px)`,
  borderInline: `${vars.stroke.hair} solid ${vars.color.intent.danger}`,
});

const markerBase = style({
  position: "absolute",
  left: posVar,
  top: "50%",
  width: "14px",
  height: "14px",
  marginInlineStart: "-7px",
  marginBlockStart: "-7px",
  borderRadius: vars.radius.pill,
  borderWidth: vars.stroke.outline,
  borderStyle: "solid",
});

/** Nominal window — dashed, stays visible even when a bulletin came early. */
export const nominalMarker = style([
  markerBase,
  {
    background: vars.color.surface.raised,
    borderColor: vars.color.border.strong,
    borderStyle: "dashed",
  },
]);

/** The bulletin actually issued — filled with its IMD stage colour. */
export const issuedMarker = styleVariants({
  watch: [markerBase, { background: vars.color.stage.watch, borderColor: vars.color.stage.watch }],
  alert: [markerBase, { background: vars.color.stage.alert, borderColor: vars.color.stage.alert }],
  warning: [
    markerBase,
    { background: vars.color.stage.warning, borderColor: vars.color.stage.warning },
  ],
  postLandfall: [
    markerBase,
    { background: vars.color.stage.postLandfall, borderColor: vars.color.stage.postLandfall },
  ],
});

/** Never animated. */
export const nowPin = style({
  position: "absolute",
  left: posVar,
  top: "-4px",
  bottom: "-4px",
  width: vars.stroke.outline,
  marginInlineStart: "-1px",
  background: vars.color.text.primary,
});

export const nowLabel = style({
  position: "absolute",
  top: "-22px",
  transform: "translateX(-50%)",
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  background: vars.color.text.primary,
  color: vars.color.text.inverse,
  whiteSpace: "nowrap",
});

export const cards = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: vars.space[4],
  "@media": { "screen and (max-width: 900px)": { gridTemplateColumns: "repeat(2, 1fr)" } },
});

/** A stage is a label group, not a card. The accent is a short top rule. */
export const card = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  paddingBlockStart: vars.space[3],
  borderBlockStart: "3px solid transparent",
});

export const cardAccent = styleVariants({
  watch: { borderBlockStartColor: vars.color.stage.watch },
  alert: { borderBlockStartColor: vars.color.stage.alert },
  warning: { borderBlockStartColor: vars.color.stage.warning },
  postLandfall: { borderBlockStartColor: vars.color.stage.postLandfall },
});

export const cardSkipped = style({
  background: vars.color.intent.dangerSoft,
  borderColor: vars.color.intent.danger,
});

export const cardCurrent = style({
  borderColor: vars.color.focus.ring,
  borderWidth: vars.stroke.outline,
});

/** Stage chip: IMD colours, correct text token per fill lightness. */
const chipBase = style({
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: "600",
});

export const chip = styleVariants({
  // text.onDark on the dark grey and red fills; text.onLight on yellow/orange.
  watch: [chipBase, { background: vars.color.stage.watch, color: vars.color.text.onDark }],
  alert: [chipBase, { background: vars.color.stage.alert, color: vars.color.text.onLight }],
  warning: [chipBase, { background: vars.color.stage.warning, color: vars.color.text.onLight }],
  postLandfall: [
    chipBase,
    { background: vars.color.stage.postLandfall, color: vars.color.text.onDark },
  ],
});

export const meta = style({ color: vars.color.text.muted });

export const skippedTag = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[1],
  color: vars.color.intent.danger,
  fontWeight: "600",
});

export const srCaption = style({ color: vars.color.text.muted });
