import type { LayerRef } from "@/api/endpoints";

import type { MapPalette, RGBA } from "./tokens";

/**
 * Class-indexed PNG layers -> token-coloured canvases for deck.gl.
 *
 * The backend serves each layer as greyscale PNG whose pixel value is a class
 * index, and names the classes after design tokens. Colour is decided here,
 * from the theme, so the backend never bakes in a colour.
 *
 * Flood bands also carry a PATTERN (dots / hatch / solid), so depth survives
 * greyscale and a washed-out projector. Wind uses a fill ramp with rising
 * opacity so it reads as an envelope, not as water.
 */

const UPSCALE = 4; // pattern resolution per data cell

type Pattern = "solid" | "dots" | "hatch" | "cross";

interface ClassStyle {
  color: RGBA;
  fillAlpha: number;
  pattern: Pattern;
}

function styleFor(layer: string, cls: string, p: MapPalette): ClassStyle | null {
  if (cls === "none") return null;
  if (layer === "flood_depth") {
    if (cls === "floodShallow") return { color: p.floodShallow, fillAlpha: 150, pattern: "dots" };
    if (cls === "floodModerate") return { color: p.floodModerate, fillAlpha: 170, pattern: "hatch" };
    return { color: p.floodDeep, fillAlpha: 200, pattern: "solid" };
  }
  if (layer === "wind") {
    const tier = ["windLow", "windModerate", "windSevere", "windExtreme"].indexOf(cls);
    const color = [p.windLow, p.windModerate, p.windSevere, p.windExtreme][Math.max(tier, 0)] ?? p.windLow;
    // Light envelope: wind must never read as water or hide the flood beneath.
    return { color, fillAlpha: 14 + 14 * Math.max(tier, 0), pattern: "solid" };
  }
  if (cls === "agreement") return { color: p.agreement, fillAlpha: 210, pattern: "solid" };
  if (cls === "miss") return { color: p.miss, fillAlpha: 180, pattern: "cross" };
  return { color: p.falseAlarm, fillAlpha: 170, pattern: "hatch" };
}

function inked(pattern: Pattern, x: number, y: number): boolean {
  if (pattern === "dots") return x % 4 === 1 && y % 4 === 1;
  if (pattern === "hatch") return (x + y) % 4 === 0;
  if (pattern === "cross") return (x + y) % 4 === 0 || (x - y + 64) % 4 === 0;
  return false;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error(`layer image failed to load: ${url}`));
    };
    img.src = url;
  });
}

export async function classCanvas(ref: LayerRef, palette: MapPalette): Promise<HTMLCanvasElement> {
  const img = await loadImage(ref.url);
  const src = document.createElement("canvas");
  src.width = ref.width;
  src.height = ref.height;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("2d canvas unavailable");
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, ref.width, ref.height).data;

  const out = document.createElement("canvas");
  out.width = ref.width * UPSCALE;
  out.height = ref.height * UPSCALE;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("2d canvas unavailable");
  const image = octx.createImageData(out.width, out.height);
  const styles = ref.classes.map((c) => styleFor(ref.layer, c, palette));

  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / UPSCALE);
    for (let x = 0; x < out.width; x++) {
      const cls = data[(sy * ref.width + Math.floor(x / UPSCALE)) * 4] ?? 0;
      const s = styles[cls];
      if (!s) continue;
      const i = (y * out.width + x) * 4;
      const ink = inked(s.pattern, x, y);
      const [r, g, b] = ink ? palette.ink : s.color;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = ink ? 200 : s.fillAlpha;
    }
  }
  octx.putImageData(image, 0, 0);
  return out;
}
