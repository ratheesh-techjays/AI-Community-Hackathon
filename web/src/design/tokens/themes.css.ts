import { createGlobalTheme } from "@vanilla-extract/css";

import { vars } from "./contract.css";
import {
  accent,
  color,
  duration,
  easing,
  fontFamily,
  fontWeight,
  glass,
  layout,
  radius,
  shadow,
  shimmer,
  space,
  stroke,
  zIndex,
  type ThemeId,
} from "./source";

/**
 * Both themes, generated from one source so they cannot drift.
 *
 * Writing them by hand would mean transcribing ~50 tokens twice and hoping the
 * shapes stay aligned. Projecting from `source.ts` makes a missing dark value
 * a type error at build time.
 */
function build(theme: ThemeId) {
  const pick = (pair: { light: string; dark: string }): string => pair[theme];

  return {
    color: {
      surface: {
        base: pick(color.surface.base),
        raised: pick(color.surface.raised),
        sunken: pick(color.surface.sunken),
      },
      border: {
        default: pick(color.border.default),
        strong: pick(color.border.strong),
      },
      text: {
        primary: pick(color.text.primary),
        secondary: pick(color.text.secondary),
        muted: pick(color.text.muted),
        inverse: pick(color.text.inverse),
        onLight: pick(color.text.onLight),
        onDark: pick(color.text.onDark),
      },
      intent: {
        info: pick(color.intent.info),
        success: pick(color.intent.success),
        warning: pick(color.intent.warning),
        danger: pick(color.intent.danger),
        infoSoft: pick(color.intent.infoSoft),
        successSoft: pick(color.intent.successSoft),
        warningSoft: pick(color.intent.warningSoft),
        dangerSoft: pick(color.intent.dangerSoft),
      },
      focus: { ring: pick(color.focus.ring) },
      stage: {
        watch: pick(color.stage.watch),
        alert: pick(color.stage.alert),
        warning: pick(color.stage.warning),
        postLandfall: pick(color.stage.postLandfall),
      },
      hazard: {
        floodShallow: pick(color.hazard.floodShallow),
        floodModerate: pick(color.hazard.floodModerate),
        floodDeep: pick(color.hazard.floodDeep),
        windLow: pick(color.hazard.windLow),
        windModerate: pick(color.hazard.windModerate),
        windSevere: pick(color.hazard.windSevere),
        windExtreme: pick(color.hazard.windExtreme),
        compromised: pick(color.hazard.compromised),
        compromisedSoft: pick(color.hazard.compromisedSoft),
        observedTruth: pick(color.hazard.observedTruth),
        predicted: pick(color.hazard.predicted),
        agreement: pick(color.hazard.agreement),
        miss: pick(color.hazard.miss),
        falseAlarm: pick(color.hazard.falseAlarm),
      },
      disclosure: {
        heuristic: pick(color.disclosure.heuristic),
        modelled: pick(color.disclosure.modelled),
        validated: pick(color.disclosure.validated),
        fallback: pick(color.disclosure.fallback),
        heuristicSoft: pick(color.disclosure.heuristicSoft),
        modelledSoft: pick(color.disclosure.modelledSoft),
        validatedSoft: pick(color.disclosure.validatedSoft),
        fallbackSoft: pick(color.disclosure.fallbackSoft),
      },
      map: {
        land: pick(color.map.land),
        water: pick(color.map.water),
        road: pick(color.map.road),
      },
      glass: {
        fill: pick(glass.fill),
        fillSolid: pick(glass.fillSolid),
        border: pick(glass.border),
      },
      shimmer: { base: pick(shimmer.base), highlight: pick(shimmer.highlight) },
    },
    font: fontFamily,
    weight: fontWeight,
    space,
    radius,
    shadow: {
      rest: pick(shadow.rest),
      lift: pick(shadow.lift),
      float: pick(shadow.float),
      popover: pick(shadow.popover),
    },
    accent: { bar: pick(accent.bar) },
    blur: { glass: glass.blur },
    stroke,
    duration,
    easing,
    z: zIndex,
    layout,
  };
}

// Light is first and the fallback.
createGlobalTheme(":root", vars, build("light"));

// Night control room. Applied via <html data-theme="dark">.
createGlobalTheme(':root[data-theme="dark"]', vars, build("dark"));
