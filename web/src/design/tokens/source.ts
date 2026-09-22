/**
 * PRAHARI DESIGN SYSTEM — TOKEN SOURCE OF TRUTH
 *
 * A verbatim transcription of the published design system (`tokens.json`,
 * PRAHARI v1). This is the ONLY file in the codebase permitted to contain raw
 * colour, length, or duration literals; the ESLint rule banning them is
 * disabled for this path alone.
 *
 * Do not edit values here to "fix" a screen. Change the design system, then
 * re-transcribe. Every token below carries its usage rule as a comment because
 * those rules are load-bearing, not decorative.
 *
 * Two themes: `light` ("Day / projector") is first and the fallback;
 * `dark` ("Night control room") is a requirement, not a preference.
 */

export const themes = ["light", "dark"] as const;
export type ThemeId = (typeof themes)[number];

type Pair = { readonly light: string; readonly dark: string };

/** Same value in both themes — used where a fill must not shift with theme. */
const invariant = (v: string): Pair => ({ light: v, dark: v });

export const color = {
  surface: {
    /** Console background. Every text token's contrast is measured against it. */
    base: { light: "#eef0f3", dark: "#0e1216" },
    /** Panels, cards, table bodies, the topbar. */
    raised: { light: "#ffffff", dark: "#171c23" },
    /** Map wells, provenance blocks, table header rows. */
    sunken: { light: "#e2e5ea", dark: "#080b0e" },
  },
  border: {
    /** Hairlines between panels and table rows. Borders separate; shadows never do. */
    default: { light: "#c9ced6", dark: "#2c343e" },
    /** Control outlines that must survive a bad projector (3:1 on surface.base). */
    strong: { light: "#7c8593", dark: "#5a6572" },
  },
  text: {
    primary: { light: "#111519", dark: "#eef1f4" },
    secondary: { light: "#3d4652", dark: "#b6c0cc" },
    /** Timestamps, provenance, footnotes. 4.5:1 floor in both themes. */
    muted: { light: "#5c6673", dark: "#8e9aa8" },
    inverse: { light: "#ffffff", dark: "#0e1216" },
    /** On stage.alert / stage.warning / floodShallow / falseAlarm. Never white on yellow. */
    onLight: { light: "#111519", dark: "#0e1216" },
    /** White in BOTH themes: on stage.watch, stage.postLandfall, floodDeep. */
    onDark: invariant("#ffffff"),
  },
  intent: {
    info: { light: "#1f5fbf", dark: "#7fb0f2" },
    /** Confirmed, validated, reachable. Never the only channel: pair with a check glyph. */
    success: { light: "#1f6f3a", dark: "#63c47f" },
    /** Attention without an order yet. */
    warning: { light: "#8a5300", dark: "#e9ad3f" },
    /** Orders, hard deadlines, missed windows. */
    danger: { light: "#b1271f", dark: "#f38a80" },
    infoSoft: { light: "#e3ecfa", dark: "#15294a" },
    successSoft: { light: "#e0f1e5", dark: "#0f2d1a" },
    warningSoft: { light: "#fbecd2", dark: "#3a2606" },
    dangerSoft: { light: "#fbe3e1", dark: "#3f1512" },
  },
  focus: {
    /** 2px solid ring, 2px offset. Meets 3:1 on all surfaces in both themes. */
    ring: { light: "#1f5fbf", dark: "#7fb0f2" },
  },
  /**
   * IMD's own colour code. IDENTICAL in both themes.
   * Use ONLY for StageTimeline and stage chips — never as generic warning colours.
   */
  stage: {
    /** Pre-Cyclone Watch, T-72h. IMD assigns no colour; neutral grey + text.onDark. */
    watch: invariant("#66707e"),
    /** Cyclone Alert, T-48h — IMD Yellow. Text is text.onLight, never white. */
    alert: invariant("#f2c200"),
    /** Cyclone Warning, T-24h — IMD Orange. Text is text.onLight. */
    warning: invariant("#ec7d10"),
    /** Post-Landfall Outlook, T-12h — IMD Red. Text is text.onDark. */
    postLandfall: invariant("#c3231b"),
  },
  hazard: {
    // Flood depth: blue ramp. Each band ALSO carries a pattern so the ramp
    // survives greyscale and a washed-out projector. Bands do not shift theme.
    /** < 0.5 m. Fill + fine dot pattern. */
    floodShallow: invariant("#9ecbe9"),
    /** 0.5–1.5 m. Fill + diagonal hatch. */
    floodModerate: invariant("#3f8ccc"),
    /** > 1.5 m. Solid fill, lifted in dark so it separates from surface.sunken. */
    floodDeep: { light: "#123f7a", dark: "#245a9e" },

    // Wind: violet ramp, drawn as OUTLINE bands whose stroke grows with class,
    // so wind can never be mistaken for water.
    /** Gale 62–87 km/h. */
    windLow: { light: "#e2d3ec", dark: "#5a4470" },
    /** Storm 88–117 km/h. */
    windModerate: { light: "#b08ad0", dark: "#9a74bb" },
    /** Severe / very severe 118–221 km/h. Thicker stroke. */
    windSevere: { light: "#77419f", dark: "#c39ee0" },
    /** Extremely severe / super 222+ km/h. Thickest stroke. */
    windExtreme: { light: "#3e1a5e", dark: "#e6d1f3" },

    /** A shelter inside the surge zone. ALWAYS with ⚠ and the word COMPROMISED. */
    compromised: { light: "#a4123b", dark: "#ff8fae" },
    compromisedSoft: { light: "#fbe1e9", dark: "#3d0f1e" },

    // Validation overlay: five classes told apart by hue AND lightness AND pattern.
    /** Sentinel-1 observed extent: 2px DASHED outline only, never a fill. */
    observedTruth: { light: "#16191d", dark: "#f4f6f8" },
    /** Model predicted extent: 2px SOLID outline only. */
    predicted: { light: "#1f5fbf", dark: "#7fb0f2" },
    /** Predicted AND observed (hit). Solid fill, darkest of the three. */
    agreement: { light: "#0d5b4a", dark: "#11705c" },
    /** Observed but not predicted. Fill + cross-hatch, mid lightness. */
    miss: { light: "#b8407c", dark: "#d46fa6" },
    /** Predicted but not observed. Fill + diagonal hatch, lightest. */
    falseAlarm: invariant("#f1cd6d"),
  },
  /**
   * Disclosure badge inks. The heuristic amber is deliberately NOT the danger
   * red: a heuristic is a known limitation, not an alarm.
   */
  disclosure: {
    heuristic: { light: "#8a5300", dark: "#e9ad3f" },
    modelled: { light: "#1f5fbf", dark: "#7fb0f2" },
    validated: { light: "#1f6f3a", dark: "#63c47f" },
    fallback: { light: "#5c6673", dark: "#8e9aa8" },
    heuristicSoft: { light: "#fbecd2", dark: "#3a2606" },
    modelledSoft: { light: "#e3ecfa", dark: "#15294a" },
    validatedSoft: { light: "#e0f1e5", dark: "#0f2d1a" },
    fallbackSoft: { light: "#e6e9ee", dark: "#242c35" },
  },
  map: {
    land: { light: "#dfe3e8", dark: "#1c232b" },
    water: { light: "#c8d7e3", dark: "#0d1a26" },
    road: { light: "#ffffff", dark: "#3a4552" },
  },
} as const;

export const fontFamily = {
  sans: '"IBM Plex Sans", "Noto Sans Oriya", system-ui, sans-serif',
  odia: '"Noto Sans Oriya", "IBM Plex Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
} as const;

/**
 * Named text styles. Odia styles are 4–6px taller at the same size because
 * matras stack above and below the baseline. NEVER put Odia in an English style.
 * Odia has no uppercase and no letter-spacing — never apply either.
 */
export const textStyle = {
  // Display (sans)
  headlineNumber: {
    family: "sans",
    fontSize: "40px",
    lineHeight: "44px",
    fontWeight: "600",
    letterSpacing: "-0.01em",
  },
  screenTitle: { family: "sans", fontSize: "20px", lineHeight: "26px", fontWeight: "600" },
  sectionTitle: { family: "sans", fontSize: "15px", lineHeight: "20px", fontWeight: "600" },

  // Text, English (sans)
  body: { family: "sans", fontSize: "14px", lineHeight: "20px", fontWeight: "400" },
  bodyStrong: { family: "sans", fontSize: "14px", lineHeight: "20px", fontWeight: "600" },
  label: {
    family: "sans",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: "500",
    letterSpacing: "0.04em",
  },
  caption: { family: "sans", fontSize: "12px", lineHeight: "16px", fontWeight: "400" },

  // Text, Odia (odia) — taller leading
  bodyOd: { family: "odia", fontSize: "14px", lineHeight: "24px", fontWeight: "400" },
  bodyStrongOd: { family: "odia", fontSize: "14px", lineHeight: "24px", fontWeight: "600" },
  labelOd: { family: "odia", fontSize: "12px", lineHeight: "20px", fontWeight: "500" },
  screenTitleOd: { family: "odia", fontSize: "20px", lineHeight: "32px", fontWeight: "600" },

  // Data (mono) — digits align down a column
  clock: { family: "mono", fontSize: "14px", lineHeight: "20px", fontWeight: "500" },
  metric: { family: "mono", fontSize: "12px", lineHeight: "16px", fontWeight: "500" },
} as const;

export type TextStyleName = keyof typeof textStyle;

/** A 4px grid. Console density. */
export const space = {
  0: "0",
  1: "4px", // badge vertical padding; glyph-to-word gap
  2: "8px", // table cell vertical padding; gap between badges
  3: "12px", // table cell horizontal padding; gap between stat cards
  4: "16px", // panel padding; gutter between panels
  6: "24px", // section spacing inside a panel
  8: "32px", // screen margins on a projector
  12: "48px", // topbar height
} as const;

/** Nearly square. Rounded corners read as consumer software. */
export const radius = {
  sm: "2px", // badges, row selection, pattern swatches
  md: "4px", // cards, panels, buttons, callouts
  pill: "999px", // ONLY timeline stage markers and the NOW pin
} as const;

/**
 * Elevation. The design system's rule stands -- borders separate panels,
 * shadows do not -- so these are used ONLY for things that genuinely float:
 * the map legend, the disclosure popover, a hovered card lifting a little.
 */
export const shadow = {
  /** Resting card. Barely there; gives an edge without a drop shadow look. */
  rest: {
    light: "0 1px 1px rgba(17,21,25,0.04)",
    dark: "0 1px 1px rgba(0,0,0,0.30)",
  },
  /** Hover lift on an interactive card or row. */
  lift: {
    light: "0 2px 4px rgba(17,21,25,0.08), 0 8px 16px rgba(17,21,25,0.06)",
    dark: "0 2px 4px rgba(0,0,0,0.45), 0 8px 16px rgba(0,0,0,0.35)",
  },
  /** Floats over the map: legend, popover. */
  float: {
    light: "0 1px 2px rgba(17,21,25,0.12), 0 4px 12px rgba(17,21,25,0.10)",
    dark: "0 1px 2px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)",
  },
  /** The one modal-grade shadow, for the disclosure popover. */
  popover: {
    light: "0 2px 4px rgba(17,21,25,0.10), 0 12px 32px rgba(17,21,25,0.16)",
    dark: "0 2px 4px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.6)",
  },
} as const;

/**
 * GLASS — used ONLY for surfaces that float over the map.
 *
 * This is the one place translucency is correct: a legend over cartography
 * should let the map read through it. It is NEVER used on a data surface,
 * where it would drop text contrast below AA on a washed-out projector.
 *
 * Every glass surface pairs a translucent background with a solid fallback
 * for browsers without backdrop-filter, and keeps a visible border so the
 * panel edge survives against any map colour underneath.
 */
export const glass = {
  /** Translucent fill. Deliberately high alpha: legibility beats the effect. */
  fill: {
    light: "rgba(255,255,255,0.82)",
    dark: "rgba(23,28,35,0.82)",
  },
  /** Solid fallback where backdrop-filter is unsupported. */
  fillSolid: { light: "#ffffff", dark: "#171c23" },
  /** Hairline that keeps the panel edge readable over any basemap. */
  border: {
    light: "rgba(17,21,25,0.14)",
    dark: "rgba(255,255,255,0.14)",
  },
  blur: "12px",
} as const;

/**
 * A single restrained accent, used for the command-bar rule and section
 * markers. Deliberately NOT a blue-purple gradient -- the design system bans
 * AI-trope decoration, and a government console earns its polish through
 * precision rather than ornament.
 */
export const accent = {
  bar: {
    light: "linear-gradient(90deg, #1f5fbf 0%, #1f5fbf 32%, rgba(31,95,191,0) 100%)",
    dark: "linear-gradient(90deg, #7fb0f2 0%, #7fb0f2 32%, rgba(127,176,242,0) 100%)",
  },
} as const;

/** Shimmer for LOADING SKELETONS only. Motion here means "not ready yet". */
export const shimmer = {
  base: { light: "#e2e5ea", dark: "#1c232b" },
  highlight: { light: "#f2f4f7", dark: "#28313b" },
} as const;

/** Line weights for map layers and outlines. */
export const stroke = {
  hair: "1px", // table rules, panel borders
  outline: "2px", // predicted/observed validation outlines, focus ring
  wind: "3px", // wind bands (windSevere 4px, windExtreme 5px)
  windSevere: "4px",
  windExtreme: "5px",
} as const;

/** Motion is minimal in an operations console. Never animate the NOW pin. */
export const duration = {
  instant: "0ms",
  fast: "120ms",
  normal: "180ms",
} as const;

export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const zIndex = {
  base: "0",
  map: "10",
  panel: "20",
  float: "30",
  popover: "40",
} as const;

/** 1280-wide three-region console. */
export const layout = {
  consoleMaxWidth: "1280px",
  topbarHeight: space[12],
} as const;
