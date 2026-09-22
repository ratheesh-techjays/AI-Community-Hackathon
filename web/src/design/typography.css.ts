import { styleVariants } from "@vanilla-extract/css";

import { vars } from "./tokens/contract.css";
import { textStyle, type TextStyleName } from "./tokens/source";

/**
 * The design system's named text styles, as classes.
 *
 * Use `text.body`, `text.clock`, `text.bodyOd` — never an ad-hoc font-size.
 * Odia styles carry 4–6px more leading than their English pair at the same
 * size, because matras stack above and below the baseline. Never put Odia
 * text in an English style.
 */
const FAMILY = {
  sans: vars.font.sans,
  odia: vars.font.odia,
  mono: vars.font.mono,
} as const;

type Spec = (typeof textStyle)[TextStyleName];

const toRule = (spec: Spec) => ({
  fontFamily: FAMILY[spec.family],
  fontSize: spec.fontSize,
  lineHeight: spec.lineHeight,
  fontWeight: spec.fontWeight,
  ...("letterSpacing" in spec ? { letterSpacing: spec.letterSpacing } : {}),
  // Tabular figures throughout: quantities must line up down a column.
  fontVariantNumeric: "tabular-nums" as const,
});

export const text = styleVariants(textStyle, (spec) => toRule(spec));

/**
 * Uppercase label treatment. Applied to `text.label` only.
 * NEVER to an Odia label — Odia has no uppercase and no letter-spacing.
 */
export const labelCaps = styleVariants({
  on: { textTransform: "uppercase" },
});
