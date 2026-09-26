import { MapboxOverlay } from "@deck.gl/mapbox";
import { BitmapLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

import type { LayerRef } from "@/api/endpoints";
import type { GeoFocus, MapShelter } from "@/features/scenario/types";

import { classCanvas } from "./raster";
import { useResolvedTokens } from "./tokens";
import * as styles from "./ImpactMap.css";

/**
 * The real impact map: MapLibre basemap + deck.gl overlays.
 *
 * Loaded lazily (see ImpactMap.tsx) so deck.gl and MapLibre stay out of the
 * initial bundle. Layers: flood depth and wind from the run's class PNGs,
 * the IBTrACS track, and every register shelter, compromised ones with a
 * halo and a label. Colours come from tokens via useResolvedTokens().
 */

export interface DeckMapProps {
  bbox: readonly [number, number, number, number];
  flood?: LayerRef | null;
  wind?: LayerRef | null;
  overlay?: LayerRef | null;
  track?: { lat: number; lon: number }[];
  shelters?: MapShelter[];
  focus?: GeoFocus | null;
  label: string;
}

// MapLibre 6 runs tile decoding in a separate ES-module worker; point it at
// the bundled file or no vector tile is ever requested.
setWorkerUrl(maplibreWorkerUrl);

// OpenFreeMap: keyless vector tiles on OpenStreetMap data. Positron is muted,
// so hazard overlays keep the contrast. (CARTO raster tiles now need a key.)
const BASEMAP = "https://tiles.openfreemap.org/styles/positron";

export default function DeckMap({
  bbox,
  flood,
  wind,
  overlay,
  track = [],
  shelters = [],
  focus,
  label,
}: DeckMapProps): JSX.Element {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const palette = useResolvedTokens();
  const [images, setImages] = useState<Record<string, HTMLCanvasElement>>({});
  const [failed, setFailed] = useState(false);

  const [ready, setReady] = useState(false);

  // Map instance: created once per mount. Creation and teardown are pushed off
  // the click that changed the route: React flushes effects of a click before
  // paint, and building or removing a WebGL map there made navigation feel
  // stuck (about 0.5-0.9 s). The frame keeps its size, so nothing shifts.
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let start = 0;
    // After the next paint (a frame, then a task): the new screen shows first,
    // and the map fills its reserved frame a moment later.
    const frame = requestAnimationFrame(() => {
      start = window.setTimeout(create, 0);
    });
    function create(): void {
      if (!container.current) return;
      map = new MapLibreMap({
        container: container.current,
        style: BASEMAP,
        bounds: [bbox[0], bbox[1], bbox[2], bbox[3]],
        fitBoundsOptions: { padding: 12 },
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      const deck = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(deck);
      mapRef.current = map;
      overlayRef.current = deck;
      setReady(true);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(start);
      const doomed = map;
      mapRef.current = null;
      overlayRef.current = null;
      if (doomed) {
        window.setTimeout(() => {
          doomed.remove();
        }, 0);
      }
    };
    // bbox is fixed per run; re-creating the map on every render would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Class PNGs -> token-coloured canvases.
  useEffect(() => {
    let cancelled = false;
    const refs = [flood, wind, overlay].filter((r): r is LayerRef => Boolean(r));
    Promise.all(refs.map(async (r) => [r.layer, await classCanvas(r, palette)] as const))
      .then((pairs) => {
        if (!cancelled) setImages(Object.fromEntries(pairs));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [flood, wind, overlay, palette]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lon, focus.lat], zoom: 11, duration: 600 });
  }, [focus, ready]);

  const layers = useMemo(() => {
    const bounds: [number, number, number, number] = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const bitmap = (id: string) =>
      images[id]
        ? new BitmapLayer({ id: `bm-${id}`, image: images[id], bounds, opacity: 1 })
        : null;
    const labelled = shelters.filter((s) => s.labelled);
    return [
      bitmap("wind"),
      bitmap("flood_depth"),
      bitmap("validation"),
      track.length > 1
        ? new PathLayer<{ path: [number, number][] }>({
            id: "track",
            data: [{ path: track.map((p): [number, number] => [p.lon, p.lat]) }],
            getPath: (d) => d.path,
            getColor: palette.ink,
            getWidth: 2,
            widthUnits: "pixels",
          })
        : null,
      new ScatterplotLayer<MapShelter>({
        id: "shelters",
        data: shelters,
        getPosition: (s) => [s.lon, s.lat],
        getRadius: (s) => (s.status === "compromised" ? 7 : 4),
        radiusUnits: "pixels",
        getFillColor: (s) =>
          s.status === "compromised" ? palette.compromised : s.status === "watch" ? palette.watch : palette.safe,
        // Halo: a compromised shelter is a ringed dot, not only a red one.
        stroked: true,
        getLineColor: (s) => (s.status === "compromised" ? palette.inverse : palette.ink),
        getLineWidth: (s) => (s.status === "compromised" ? 3 : 1),
        lineWidthUnits: "pixels",
      }),
      new TextLayer<MapShelter>({
        id: "shelter-labels",
        data: labelled,
        getPosition: (s) => [s.lon, s.lat],
        getText: (s) => `⚠ ${s.name}`,
        getSize: 11,
        getColor: palette.compromised,
        getPixelOffset: [0, -14],
        background: true,
        getBackgroundColor: palette.inverse,
        characterSet: "auto",
      }),
      focus
        ? new ScatterplotLayer<GeoFocus>({
            id: "focus",
            data: [focus],
            getPosition: (f) => [f.lon, f.lat],
            getRadius: 16,
            radiusUnits: "pixels",
            filled: false,
            stroked: true,
            getLineColor: palette.focus,
            getLineWidth: 3,
            lineWidthUnits: "pixels",
          })
        : null,
    ].filter(Boolean);
  }, [images, track, shelters, focus, palette, bbox]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers, ready]);

  return (
    <div className={styles.canvasWrap}>
      <div ref={container} className={styles.canvas} role="img" aria-label={label} />
      {failed ? (
        <span className={styles.mapError} role="status">
          Map layers could not be loaded. Every value is also in the tables below.
        </span>
      ) : null}
    </div>
  );
}
