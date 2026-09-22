import { style, styleVariants } from "@vanilla-extract/css";

import { vars } from "./tokens/contract.css";

/**
 * PATTERN FILLS — the second channel.
 *
 * The design system's rule: "Don't introduce a class with hue only." Every
 * hazard class carries a hue AND a pattern (or stroke weight) AND a word, so
 * the ramps survive greyscale, a washed-out projector, and a colour-blind
 * reader.
 *
 * The same class names are used for legend swatches and SVG map fills, so the
 * legend and the map cannot drift apart.
 *
 * Flood:      dots -> diagonal hatch -> solid   (shallow -> moderate -> deep)
 * Validation: solid (agreement) / cross-hatch (miss) / diagonal (falseAlarm)
 */

const PATTERN_INK = "rgb(0 0 0 / 0.42)";

export const swatch = style({
  display: "inline-block",
  width: "16px",
  height: "16px",
  borderRadius: vars.radius.sm,
  border: `${vars.stroke.hair} solid ${vars.color.border.strong}`,
  verticalAlign: "text-bottom",
  flexShrink: 0,
});

/** Fine dots — shallow flood. */
const dots = {
  backgroundImage: `radial-gradient(${PATTERN_INK} 1px, transparent 1px)`,
  backgroundSize: "4px 4px",
};

/** Diagonal hatch — moderate flood, false alarm. */
const diagonal = {
  backgroundImage: `repeating-linear-gradient(45deg, ${PATTERN_INK} 0 1px, transparent 1px 4px)`,
};

/** Cross hatch — miss. */
const cross = {
  backgroundImage: [
    `repeating-linear-gradient(45deg, ${PATTERN_INK} 0 1px, transparent 1px 5px)`,
    `repeating-linear-gradient(-45deg, ${PATTERN_INK} 0 1px, transparent 1px 5px)`,
  ].join(", "),
};

export const pattern = styleVariants({
  none: {},
  dots,
  diagonal,
  cross,
});

/** Flood depth bands: fill + mandated pattern, paired in one class. */
export const flood = styleVariants({
  shallow: [{ background: vars.color.hazard.floodShallow }, dots],
  moderate: [{ background: vars.color.hazard.floodModerate }, diagonal],
  deep: [{ background: vars.color.hazard.floodDeep }],
});

/**
 * Wind bands: OUTLINE only, stroke width grows with class, so wind can never
 * be mistaken for water.
 */
export const wind = styleVariants({
  low: { border: `${vars.stroke.wind} solid ${vars.color.hazard.windLow}`, background: "none" },
  moderate: {
    border: `${vars.stroke.wind} solid ${vars.color.hazard.windModerate}`,
    background: "none",
  },
  severe: {
    border: `${vars.stroke.windSevere} solid ${vars.color.hazard.windSevere}`,
    background: "none",
  },
  extreme: {
    border: `${vars.stroke.windExtreme} solid ${vars.color.hazard.windExtreme}`,
    background: "none",
  },
});

/**
 * Validation overlay: five classes separated by hue AND lightness AND pattern.
 * Printed in greyscale the three fills still order dark-mid-light, and the two
 * outlines still differ by dash.
 */
export const validation = styleVariants({
  agreement: [{ background: vars.color.hazard.agreement }],
  miss: [{ background: vars.color.hazard.miss }, cross],
  falseAlarm: [{ background: vars.color.hazard.falseAlarm }, diagonal],
  predicted: {
    background: "none",
    border: `${vars.stroke.outline} solid ${vars.color.hazard.predicted}`,
  },
  observedTruth: {
    background: "none",
    border: `${vars.stroke.outline} dashed ${vars.color.hazard.observedTruth}`,
  },
});
