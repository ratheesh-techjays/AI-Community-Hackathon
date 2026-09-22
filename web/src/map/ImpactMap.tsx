import { useId, type JSX } from "react";

import { text } from "@/design/typography.css";

import * as styles from "./ImpactMap.css";

/**
 * A stylised impact map of the Puri coast.
 *
 * This is a HAND-DRAWN SVG standing in for the real deck.gl + MapLibre layers,
 * so the console reads as a finished product while the geospatial pipeline is
 * built. It is schematic, not survey-accurate, and the caption says so — we do
 * not present a drawing as model output.
 *
 * It still obeys every design-system rule that the real map will:
 *  - flood bands carry a PATTERN as well as a hue (dots / hatch / solid)
 *  - wind bands are OUTLINES whose stroke grows with class, so wind can never
 *    be mistaken for water
 *  - a compromised shelter gets a halo, a distinct shape, AND a label
 *
 * TODO(frontend): replace with deck.gl GeoJsonLayer + BitmapLayer once the
 * backend serves signed GEE tile URLs.
 */

export interface MapPin {
  id: string;
  x: number;
  y: number;
  kind: "shelterCompromised" | "shelterSafe" | "hospital";
  label?: string;
}

interface ImpactMapProps {
  pins?: MapPin[];
  /** Highlight a location: a ring and a label, so the selected order's place is unmistakable. */
  focus?: { x: number; y: number; label: string };
  showWind?: boolean;
  showTrack?: boolean;
  /** Rendered over the map, bottom-right. */
  children?: JSX.Element;
}

const DEFAULT_PINS: MapPin[] = [
  { id: "p1", x: 214, y: 214, kind: "shelterCompromised", label: "Baliapanda" },
  { id: "p2", x: 286, y: 236, kind: "shelterCompromised", label: "Penthakata" },
  { id: "p3", x: 150, y: 242, kind: "shelterCompromised" },
  { id: "p4", x: 372, y: 196, kind: "shelterCompromised", label: "Jalakoparia" },
  { id: "p5", x: 190, y: 150, kind: "shelterSafe", label: "Guagaria" },
  { id: "p6", x: 268, y: 138, kind: "shelterSafe", label: "Chandanpur" },
  { id: "p7", x: 348, y: 128, kind: "shelterSafe" },
  { id: "p8", x: 236, y: 168, kind: "hospital", label: "Puri DHH" },
];

export function ImpactMap({
  pins = DEFAULT_PINS,
  focus,
  showWind = true,
  showTrack = true,
  children,
}: ImpactMapProps): JSX.Element {
  const uid = useId().replace(/:/g, "");
  const dots = `dots-${uid}`;
  const hatch = `hatch-${uid}`;
  const coastClip = `coast-${uid}`;

  return (
    <div className={styles.frame}>
      <svg
        className={styles.svg}
        viewBox="0 0 520 320"
        role="img"
        aria-label="Schematic impact map of the Puri coast showing modelled surge bands, wind bands, the cyclone track and shelter locations. Every value shown here is also in the tables below."
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id={dots} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" className={styles.patternInk} />
          </pattern>
          <pattern
            id={hatch}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1.4" className={styles.patternStroke} />
          </pattern>
          {/* Flood bands are clipped to land: water cannot flood the sea. */}
          <clipPath id={coastClip}>
            <path d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,320 L0,320 Z" />
          </clipPath>
        </defs>

        {/* sea */}
        <rect x="0" y="0" width="520" height="320" className={styles.sea} />

        {/* land */}
        <path
          d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,0 L0,0 Z"
          className={styles.land}
        />

        {/* surge bands, deepest nearest the coast, clipped to land */}
        <g clipPath={`url(#${coastClip})`} transform="scale(1,-1) translate(0,-300)">
          <path
            d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,96 C440,108 360,122 220,106 C150,116 80,84 0,100 Z"
            className={styles.floodShallow}
            fill={`url(#${dots})`}
          />
          <path
            d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,120 C440,130 350,142 220,128 C150,136 80,110 0,124 Z"
            className={styles.floodModerate}
          />
          <path
            d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,140 C440,146 350,156 220,146 C150,152 80,132 0,142 Z"
            className={styles.floodDeep}
          />
        </g>

        {/* the hatch pattern overlay on the moderate band — second channel */}
        <g clipPath={`url(#${coastClip})`} transform="scale(1,-1) translate(0,-300)" opacity="0.55">
          <path
            d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150 L520,120 C440,130 350,142 220,128 C150,136 80,110 0,124 Z"
            fill={`url(#${hatch})`}
          />
        </g>

        {/* coastline on top so the edge stays crisp */}
        <path
          d="M0,150 C90,132 150,168 220,158 C300,146 360,176 440,160 C480,152 505,158 520,150"
          className={styles.coastline}
        />

        {showWind ? (
          <g className={styles.windGroup}>
            <ellipse cx="300" cy="300" rx="250" ry="180" className={styles.windLow} />
            <ellipse cx="300" cy="300" rx="180" ry="128" className={styles.windModerate} />
            <ellipse cx="300" cy="300" rx="112" ry="80" className={styles.windSevere} />
          </g>
        ) : null}

        {showTrack ? (
          <g>
            <path d="M430,318 C392,290 350,268 312,252 C288,242 272,232 262,214" className={styles.track} />
            <circle cx="262" cy="214" r="5" className={styles.landfallPoint} />
            <text x="272" y="210" className={styles.landfallLabel}>
              Landfall 03 May 03:00 IST
            </text>
          </g>
        ) : null}

        {pins.map((pin) => (
          <g key={pin.id}>
            {pin.kind === "shelterCompromised" ? (
              <>
                <circle cx={pin.x} cy={pin.y} r="10" className={styles.pinHalo} />
                {/* Distinct SHAPE, not just colour: a triangle for compromised. */}
                <path
                  d={`M${pin.x},${pin.y - 6} L${pin.x + 6},${pin.y + 5} L${pin.x - 6},${pin.y + 5} Z`}
                  className={styles.pinCompromised}
                />
              </>
            ) : pin.kind === "shelterSafe" ? (
              <circle cx={pin.x} cy={pin.y} r="4.5" className={styles.pinSafe} />
            ) : (
              <rect x={pin.x - 4} y={pin.y - 4} width="8" height="8" className={styles.pinHospital} />
            )}
            {pin.label ? (
              <text x={pin.x + 10} y={pin.y + 4} className={styles.pinLabel}>
                {pin.label}
              </text>
            ) : null}
          </g>
        ))}
        {focus ? (
          <g aria-hidden="true">
            <circle cx={focus.x} cy={focus.y} r="22" className={styles.focusRing} />
            <circle cx={focus.x} cy={focus.y} r="3" className={styles.focusDot} />
            <text x={focus.x} y={focus.y - 28} textAnchor="middle" className={styles.focusLabel}>
              {focus.label}
            </text>
          </g>
        ) : null}
      </svg>

      {children}

      <p className={`${text.caption} ${styles.disclaimer}`}>
        Schematic view — geometry is illustrative, not survey-accurate. Every figure shown here also
        appears in the tables below.
      </p>
    </div>
  );
}
