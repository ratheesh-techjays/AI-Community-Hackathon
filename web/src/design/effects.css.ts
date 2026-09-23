import { keyframes, style } from "@vanilla-extract/css";

import { vars } from "./tokens/contract.css";

/**
 * VISUAL EFFECTS — and the rules about where each one may be used.
 *
 * This console is read at 2am, on a bad projector, by someone deciding whether
 * to move 180,000 people. Effects here earn their place by aiding legibility or
 * signalling state; none is decorative.
 */

// ---------------------------------------------------------------------------
// GLASS — floating surfaces over the map ONLY
// ---------------------------------------------------------------------------

/**
 * Frosted panel for something floating OVER cartography, where letting the map
 * read through is genuinely useful (the legend, a map-anchored popover).
 *
 * NEVER use on a data surface. Translucency over arbitrary map colour cannot
 * guarantee 4.5:1 on text, and this product's tables must stay readable on a
 * washed-out projector.
 *
 * Safety built in:
 *  - high-alpha fill (0.82), so contrast holds even without blur
 *  - solid `background` declared first as the no-backdrop-filter fallback
 *  - a visible border so the panel edge survives any basemap underneath
 *  - blur disabled under prefers-reduced-transparency
 */
export const glassPanel = style({
  background: vars.color.glass.fillSolid,
  border: `${vars.stroke.hair} solid ${vars.color.glass.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.float,
  "@supports": {
    "(backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))": {
      background: vars.color.glass.fill,
      backdropFilter: `blur(${vars.blur.glass}) saturate(140%)`,
      WebkitBackdropFilter: `blur(${vars.blur.glass}) saturate(140%)`,
    },
  },
  "@media": {
    // Some users disable transparency at OS level; honour it.
    "(prefers-reduced-transparency: reduce)": {
      background: vars.color.glass.fillSolid,
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    },
  },
});

// ---------------------------------------------------------------------------
// SHIMMER — loading skeletons ONLY
// ---------------------------------------------------------------------------

const sweep = keyframes({
  "0%": { backgroundPosition: "-200% 0" },
  "100%": { backgroundPosition: "200% 0" },
});

/**
 * Motion here means "not ready yet", which is the one message that benefits
 * from animation on this screen.
 *
 * It is NOT used on loaded content. An animated surface competes with the
 * alerts that actually need attention, and on a disaster console that trade is
 * never worth making.
 */
export const shimmer = style({
  background: `linear-gradient(90deg, ${vars.color.shimmer.base} 25%, ${vars.color.shimmer.highlight} 50%, ${vars.color.shimmer.base} 75%)`,
  backgroundSize: "200% 100%",
  animationName: sweep,
  animationDuration: vars.duration.shimmer,
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
  borderRadius: vars.radius.sm,
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationName: "none",
      background: vars.color.shimmer.base,
    },
  },
});

// ---------------------------------------------------------------------------
// ELEVATION & INTERACTION
// ---------------------------------------------------------------------------

/** Resting panel. Border does the separating; the shadow only gives an edge. */
export const panel = style({
  background: vars.color.surface.raised,
  border: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.rest,
});

/** A panel that responds to the pointer. Lift is small and fast — 120ms. */
export const interactive = style({
  transitionProperty: "box-shadow, border-color, background-color, transform",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
  selectors: {
    "&:hover": {
      boxShadow: vars.shadow.lift,
      borderColor: vars.color.border.strong,
    },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": { transitionDuration: vars.duration.instant },
  },
});

/** Table row hover. Tint only — the semantic row tints must still dominate. */
export const rowHover = style({
  transitionProperty: "background-color",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
});

/**
 * The command-bar rule: a single restrained accent that fades out.
 * Not a blue-purple gradient — the design system bans AI-trope decoration.
 */
export const accentRule = style({
  height: vars.stroke.outline,
  borderRadius: vars.radius.pill,
  background: vars.accent.bar,
});

/** A live indicator dot. Static by default; only pulses when truly live. */
export const statusDot = style({
  width: vars.space[2],
  height: vars.space[2],
  borderRadius: vars.radius.pill,
  flexShrink: 0,
});

const pulse = keyframes({
  "0%, 100%": { opacity: "1" },
  "50%": { opacity: "0.45" },
});

/** Reserved for a genuinely live feed. Never on static fixture data. */
export const livePulse = style({
  animationName: pulse,
  animationDuration: vars.duration.pulse,
  animationTimingFunction: vars.easing.standard,
  animationIterationCount: "infinite",
  "@media": { "(prefers-reduced-motion: reduce)": { animationName: "none" } },
});
