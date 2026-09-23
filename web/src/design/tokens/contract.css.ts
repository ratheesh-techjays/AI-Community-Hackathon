import { createGlobalThemeContract } from "@vanilla-extract/css";

/**
 * SEMANTIC TOKEN CONTRACT — PRAHARI design system v1.
 *
 * The shape every theme must implement. Omitting a token is a TypeScript
 * error, not a silent visual bug.
 *
 * Mirrors the published design system exactly. `stage.*` and `hazard.*` are
 * first-class members of the contract, not chart-local choices: a flood-depth
 * ramp is a semantic, accessibility-bearing decision, and IMD's stage colours
 * are an external standard we must not drift from.
 */
export const vars = createGlobalThemeContract(
  {
    color: {
      surface: { base: "", raised: "", sunken: "" },
      border: { default: "", strong: "" },
      text: {
        primary: "",
        secondary: "",
        muted: "",
        inverse: "",
        onLight: "",
        onDark: "",
      },
      intent: {
        info: "",
        success: "",
        warning: "",
        danger: "",
        infoSoft: "",
        successSoft: "",
        warningSoft: "",
        dangerSoft: "",
      },
      focus: { ring: "" },
      stage: { watch: "", alert: "", warning: "", postLandfall: "" },
      hazard: {
        floodShallow: "",
        floodModerate: "",
        floodDeep: "",
        windLow: "",
        windModerate: "",
        windSevere: "",
        windExtreme: "",
        compromised: "",
        compromisedSoft: "",
        observedTruth: "",
        predicted: "",
        agreement: "",
        miss: "",
        falseAlarm: "",
      },
      disclosure: {
        heuristic: "",
        modelled: "",
        validated: "",
        fallback: "",
        heuristicSoft: "",
        modelledSoft: "",
        validatedSoft: "",
        fallbackSoft: "",
      },
      map: { land: "", water: "", road: "" },
      /** Glass is ONLY for surfaces floating over the map. */
      glass: { fill: "", fillSolid: "", border: "" },
      shimmer: { base: "", highlight: "" },
    },
    font: { sans: "", odia: "", mono: "" },
    weight: { regular: "", medium: "", semibold: "" },
    space: { 0: "", 1: "", 2: "", 3: "", 4: "", 6: "", 8: "", 12: "" },
    radius: { sm: "", md: "", pill: "" },
    shadow: { rest: "", lift: "", float: "", popover: "" },
    accent: { bar: "" },
    blur: { glass: "" },
    stroke: { hair: "", outline: "", wind: "", windSevere: "", windExtreme: "" },
    duration: { instant: "", fast: "", normal: "", shimmer: "", pulse: "" },
    easing: { standard: "" },
    z: { base: "", map: "", panel: "", float: "", popover: "" },
    layout: { consoleMaxWidth: "", topbarHeight: "" },
  },
  (_value, path) => `prahari-${path.join("-")}`,
);
