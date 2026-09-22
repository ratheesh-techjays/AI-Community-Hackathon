import type { JSX, SVGProps } from "react";

/**
 * The icon set: small, literal, drawn on a 16 grid, 1.5–2px strokes,
 * `currentColor`. No emoji anywhere, including in Odia strings.
 *
 * DESIGN RULE: a status glyph is NEVER used without its word. Every status
 * component in this codebase renders the glyph beside a label (visible or
 * `.sr-only`), because colour is not a channel on a bad projector.
 */

export type IconName =
  | "shelter"
  | "hospital"
  | "substation"
  | "compromised"
  | "check"
  | "missed"
  | "satellite"
  | "clock"
  | "heuristic"
  | "modelled";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  /** Pixel size; 12–20 per the design system. */
  size?: number;
}

const PATHS: Record<IconName, JSX.Element> = {
  // house
  shelter: <path d="M2 7 8 2.5 14 7v6.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V7Z" />,
  // cross
  hospital: <path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5V2Z" />,
  // bolt
  substation: <path d="M9.5 1.5 4 9h3.2l-1 5.5L13 6.5H9.4l.1-5Z" />,
  // triangle-bang
  compromised: (
    <>
      <path d="M8 2 15 14H1L8 2Z" />
      <path d="M8 6.5v3.2M8 11.6v.9" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  check: <path d="M2.5 8.5 6 12l7.5-8" strokeWidth={2} strokeLinecap="round" fill="none" />,
  // circle-slash
  missed: (
    <>
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth={1.6} />
      <path d="M4 12 12 4" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  satellite: (
    <>
      <path d="M2 14c4 0 8-4 8-8" fill="none" strokeWidth={1.6} />
      <circle cx="12.5" cy="3.5" r="2" />
      <path d="M2 14h3.5M2 10.5V14" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth={1.6} />
      <path d="M8 4.5V8l2.5 1.8" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  // dashed circle -- a heuristic index, not a forecast
  heuristic: (
    <circle
      cx="8"
      cy="8"
      r="5.6"
      fill="none"
      strokeWidth={1.8}
      strokeDasharray="2.6 2.4"
      strokeLinecap="round"
    />
  ),
  // dot in circle -- numerically modelled, not yet validated
  modelled: (
    <>
      <circle cx="8" cy="8" r="5.6" fill="none" strokeWidth={1.6} />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
};

export function Icon({ name, size = 14, ...rest }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
