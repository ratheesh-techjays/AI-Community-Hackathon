import { globalStyle } from "@vanilla-extract/css";

import { vars } from "./tokens/contract.css";

globalStyle("*, *::before, *::after", { boxSizing: "border-box" });

globalStyle("html", { colorScheme: "light dark" });

globalStyle("body", {
  margin: vars.space[0],
  fontFamily: vars.font.sans,
  // eslint-disable-next-line no-restricted-syntax -- base reset sets the root type scale
  fontSize: "14px",
  // eslint-disable-next-line no-restricted-syntax -- base reset sets the root type scale
  lineHeight: "20px",
  fontVariantNumeric: "tabular-nums",
  color: vars.color.text.primary,
  background: vars.color.surface.base,
  WebkitFontSmoothing: "antialiased",
});

globalStyle("h1, h2, h3, h4, p, ul, ol, figure", { margin: vars.space[0] });
globalStyle("ul, ol", { paddingInlineStart: vars.space[4] });

// eslint-disable-next-line no-restricted-syntax -- base reset sets the root type scale
globalStyle("code, kbd", { fontFamily: vars.font.mono, fontSize: "12px" });

/** Odia takes the Odia family and its taller leading wherever it is marked. */
globalStyle('[lang="or"]', {
  fontFamily: vars.font.odia,
  // eslint-disable-next-line no-restricted-syntax -- base reset sets the root type scale
  lineHeight: "24px",
});

globalStyle("table", { borderCollapse: "collapse", width: "100%" });
globalStyle("th", { textAlign: "start", fontWeight: vars.weight.semibold });

globalStyle("button", {
  font: "inherit",
  color: "inherit",
  background: "none",
  border: "none",
  padding: vars.space[0],
  cursor: "pointer",
});

/**
 * 2px solid ring, 2px offset, on every interactive element in both themes.
 * `outline: none` is banned by stylelint — this must never be removed.
 */
globalStyle(":focus-visible", {
  outline: `${vars.stroke.outline} solid ${vars.color.focus.ring}`,
  outlineOffset: vars.stroke.outline,
});

globalStyle("*", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: vars.duration.instant,
      transitionDuration: vars.duration.instant,
    },
  },
});

/** Screen-reader-only, for the word that must accompany every status glyph. */
globalStyle(".sr-only", {
  position: "absolute",
  width: "1px",
  height: "1px",
  // eslint-disable-next-line no-restricted-syntax -- visually-hidden pattern needs a negative 1px margin
  margin: "-1px",
  padding: vars.space[0],
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
});
