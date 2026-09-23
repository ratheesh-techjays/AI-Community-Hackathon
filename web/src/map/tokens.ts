import { useEffect, useState } from "react";

import { vars } from "@/design/tokens/contract.css";

/**
 * Bridge design tokens into deck.gl RGBA tuples.
 *
 * deck.gl paints on a canvas and cannot read CSS, so each token's resolved
 * value is read from the document once per theme. Raw colour literals stay
 * banned in src/map/**: every colour on the map is a token.
 */

export type RGBA = [number, number, number, number];

const FALLBACK: RGBA = [128, 128, 128, 255];

function cssVarName(token: string): string | null {
  const match = /var\((--[^),]+)/.exec(token);
  return match?.[1] ?? null;
}

export function parseColor(value: string, alpha = 255): RGBA {
  const v = value.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
    const n = Number.parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return FALLBACK;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(v);
  if (rgb?.[1]) {
    const [r = 128, g = 128, b = 128] = rgb[1].split(/[ ,/]+/).map(Number);
    return [r, g, b, alpha];
  }
  return FALLBACK;
}

export function resolveToken(token: string, alpha = 255): RGBA {
  const name = cssVarName(token);
  if (!name || typeof document === "undefined") return FALLBACK;
  return parseColor(getComputedStyle(document.documentElement).getPropertyValue(name), alpha);
}

export interface MapPalette {
  floodShallow: RGBA;
  floodModerate: RGBA;
  floodDeep: RGBA;
  windLow: RGBA;
  windModerate: RGBA;
  windSevere: RGBA;
  windExtreme: RGBA;
  agreement: RGBA;
  miss: RGBA;
  falseAlarm: RGBA;
  compromised: RGBA;
  watch: RGBA;
  safe: RGBA;
  ink: RGBA;
  inverse: RGBA;
  focus: RGBA;
}

function palette(): MapPalette {
  const h = vars.color.hazard;
  return {
    floodShallow: resolveToken(h.floodShallow),
    floodModerate: resolveToken(h.floodModerate),
    floodDeep: resolveToken(h.floodDeep),
    windLow: resolveToken(h.windLow),
    windModerate: resolveToken(h.windModerate),
    windSevere: resolveToken(h.windSevere),
    windExtreme: resolveToken(h.windExtreme),
    agreement: resolveToken(h.agreement),
    miss: resolveToken(h.miss),
    falseAlarm: resolveToken(h.falseAlarm),
    compromised: resolveToken(h.compromised),
    watch: resolveToken(vars.color.intent.warning),
    safe: resolveToken(vars.color.intent.success),
    ink: resolveToken(vars.color.text.primary),
    inverse: resolveToken(vars.color.surface.raised),
    focus: resolveToken(vars.color.focus.ring),
  };
}

/** The palette for the current theme; recomputed when data-theme changes. */
export function useResolvedTokens(): MapPalette {
  const [value, setValue] = useState<MapPalette>(palette);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setValue(palette());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
    };
  }, []);
  return value;
}
