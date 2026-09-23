import { lazy, Suspense, type JSX } from "react";

import { Skeleton } from "@/components/Skeleton";
import { text } from "@/design/typography.css";

import type { DeckMapProps } from "./DeckMap";
import * as styles from "./ImpactMap.css";

/**
 * The impact map, lazily loaded.
 *
 * deck.gl + MapLibre are about 40% of the app's JS, so they load only when a
 * map is on screen (vite.config.ts splits them into the `map` chunk). The
 * frame reserves its space while loading, so the page does not jump.
 */

const DeckMap = lazy(() => import("./DeckMap"));

interface ImpactMapProps extends DeckMapProps {
  /** Rendered over the map, bottom-right (the legend). */
  children?: JSX.Element;
  caption?: string;
}

export function ImpactMap({ children, caption, ...props }: ImpactMapProps): JSX.Element {
  return (
    <figure className={styles.frame}>
      <Suspense fallback={<Skeleton height="100%" />}>
        <DeckMap {...props} />
      </Suspense>
      {children ? <div className={styles.overlay}>{children}</div> : null}
      {caption ? <figcaption className={`${text.caption} ${styles.caption}`}>{caption}</figcaption> : null}
    </figure>
  );
}
