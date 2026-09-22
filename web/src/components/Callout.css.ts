import { style, styleVariants } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * The whole border and the glyph carry the intent — never a coloured left
 * border alone. Stage colours are not used here: a Warning-stage reminder is
 * `warning`, not IMD orange.
 */

const base = style({
  display: "flex",
  gap: vars.space[3],
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
});

export const callout = styleVariants({
  danger: [
    base,
    { background: vars.color.intent.dangerSoft, borderColor: vars.color.intent.danger },
  ],
  warning: [
    base,
    { background: vars.color.intent.warningSoft, borderColor: vars.color.intent.warning },
  ],
  info: [base, { background: vars.color.intent.infoSoft, borderColor: vars.color.intent.info }],
  /**
   * The model-limitation callout. Appears on EVERY screen showing a modelled
   * layer. Sunken ground and a dashed glyph so it reads as a standing caveat,
   * not an incident.
   */
  limit: [
    base,
    {
      background: vars.color.surface.sunken,
      borderColor: vars.color.border.default,
      borderStyle: "dashed",
    },
  ],
});

export const glyph = styleVariants({
  danger: { color: vars.color.intent.danger, flexShrink: 0 },
  warning: { color: vars.color.intent.warning, flexShrink: 0 },
  info: { color: vars.color.intent.info, flexShrink: 0 },
  limit: { color: vars.color.text.muted, flexShrink: 0 },
});

export const bodyWrap = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  minWidth: 0,
});

export const title = style({ color: vars.color.text.primary });
export const body = style({ color: vars.color.text.secondary });

export const actions = style({
  display: "flex",
  gap: vars.space[2],
  flexWrap: "wrap",
  marginBlockStart: vars.space[3],
});

const buttonBase = style({
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  borderWidth: vars.stroke.hair,
  borderStyle: "solid",
  fontWeight: "600",
});

export const action = styleVariants({
  primary: [
    buttonBase,
    {
      background: vars.color.intent.danger,
      borderColor: vars.color.intent.danger,
      color: vars.color.text.inverse,
    },
  ],
  secondary: [
    buttonBase,
    {
      background: vars.color.surface.raised,
      borderColor: vars.color.border.strong,
      color: vars.color.text.primary,
    },
  ],
});
