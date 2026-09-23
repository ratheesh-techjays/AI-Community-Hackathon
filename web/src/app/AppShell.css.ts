import { style } from "@vanilla-extract/css";

import { vars } from "@/design/tokens/contract.css";

/**
 * APPLICATION SHELL — persistent sidebar + scrolling main area.
 *
 * Composition principle for this rebuild: hierarchy comes from SPACE and
 * TYPOGRAPHY, not from borders. The previous layout nested a bordered panel
 * inside a bordered panel inside a bordered card, which reads as clutter.
 *
 * Surfaces earn a border only when they genuinely float (map legend, popover)
 * or when a semantic tint needs an edge (a compromised row). Everything else
 * separates with whitespace and a quiet heading.
 */

export const shell = style({
  display: "grid",
  gridTemplateColumns: "236px 1fr",
  minHeight: "100vh",
  background: vars.color.surface.base,
  "@media": {
    "screen and (max-width: 900px)": { gridTemplateColumns: "1fr" },
  },
});

// ---------------------------------------------------------------- sidebar

export const sidebar = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[6],
  padding: vars.space[4],
  background: vars.color.surface.raised,
  // The one vertical rule in the layout: it separates the two regions.
  borderInlineEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  position: "sticky",
  top: 0,
  height: "100vh",
  "@media": {
    "screen and (max-width: 900px)": {
      position: "static",
      height: "auto",
      borderInlineEnd: "none",
      borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
    },
  },
});

/** The wordmark is a link home (the storm list). */
export const brand = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  paddingInline: vars.space[2],
  color: "inherit",
  textDecoration: "none",
});

export const brandMark = style({
  width: vars.space[4],
  height: vars.space[4],
  borderRadius: vars.radius.sm,
  background: vars.color.intent.info,
  flexShrink: 0,
});

export const brandSub = style({
  color: vars.color.text.muted,
  paddingInline: vars.space[2],
  marginBlockStart: `calc(-1 * ${vars.space[4]})`,
});

export const nav = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  // Phones: the rail becomes one scrolling row, so content starts above the fold.
  "@media": {
    "screen and (max-width: 720px)": { flexDirection: "row", flexWrap: "wrap" },
  },
});

export const navLabel = style({
  color: vars.color.text.muted,
  paddingInline: vars.space[2],
  paddingBlockEnd: vars.space[1],
  "@media": { "screen and (max-width: 720px)": { flexBasis: "100%" } },
});

const navItemBase = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[3],
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  textDecoration: "none",
  color: vars.color.text.secondary,
  transitionProperty: "background-color, color",
  transitionDuration: vars.duration.fast,
  transitionTimingFunction: vars.easing.standard,
  selectors: {
    "&:hover": { background: vars.color.surface.sunken, color: vars.color.text.primary },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": { transitionDuration: vars.duration.instant },
  },
});

export const navItem = style([navItemBase]);

export const navItemActive = style([
  navItemBase,
  {
    background: vars.color.intent.infoSoft,
    color: vars.color.intent.info,
    fontWeight: vars.weight.semibold,
  },
]);

/** Count at the right of a nav item. */
export const navCount = style({
  marginInlineStart: "auto",
  color: vars.color.text.muted,
  fontWeight: vars.weight.semibold,
});

/** A count that means work is outstanding: open orders, compromised shelters. */
export const navCountAlert = style({
  marginInlineStart: "auto",
  color: vars.color.hazard.compromised,
  fontWeight: vars.weight.semibold,
});

export const stormClock = style({ color: vars.color.text.primary });

export const headerClock = style({ marginInlineStart: "auto", color: vars.color.text.secondary });

/** Pushes the storm context and controls to the bottom of the rail. */
export const sidebarFoot = style({
  marginBlockStart: "auto",
  display: "flex",
  flexDirection: "column",
  gap: vars.space[3],
  "@media": {
    "screen and (max-width: 900px)": { marginBlockStart: vars.space[3] },
    "screen and (max-width: 720px)": { display: "none" },
  },
});

export const stormBlock = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  background: vars.color.surface.sunken,
});

export const stormRow = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
});

export const stormDot = style({ background: vars.color.stage.alert });

export const stormMeta = style({ color: vars.color.text.muted });

export const themeToggle = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderRadius: vars.radius.md,
  color: vars.color.text.secondary,
  selectors: { "&:hover": { background: vars.color.surface.sunken } },
});

// ------------------------------------------------------------------- main

export const main = style({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
});

/**
 * Sticky page header. Title left, live clock right. No border — it sits on the
 * base surface and gains a hairline only once the page scrolls under it.
 */
export const pageHeader = style({
  position: "sticky",
  top: 0,
  zIndex: vars.z.panel,
  display: "flex",
  alignItems: "center",
  gap: vars.space[4],
  flexWrap: "wrap",
  paddingInline: vars.space[8],
  paddingBlock: vars.space[4],
  background: vars.color.surface.base,
  borderBlockEnd: `${vars.stroke.hair} solid ${vars.color.border.default}`,
  "@media": { "screen and (max-width: 720px)": { paddingInline: vars.space[4] } },
});

export const pageTitleGroup = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space[1],
  minWidth: 0,
});

export const pageSubtitle = style({ color: vars.color.text.muted });

export const headerRight = style({
  marginInlineStart: "auto",
  display: "flex",
  alignItems: "center",
  gap: vars.space[4],
});

export const content = style({
  paddingInline: vars.space[8],
  paddingBlock: vars.space[6],
  display: "flex",
  flexDirection: "column",
  gap: vars.space[8],
  maxWidth: "1400px",
  width: "100%",
  "@media": { "screen and (max-width: 720px)": { paddingInline: vars.space[4] } },
});
