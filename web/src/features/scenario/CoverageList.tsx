import type { JSX } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { text } from "@/design/typography.css";

import type { ScenarioData } from "./types";
import * as styles from "./CoverageList.css";

/**
 * What this run covers, stated up front. A coast with no shelter register or a
 * storm with no satellite pair says so here, instead of showing an empty panel.
 */

interface Item {
  key: string;
  label: string;
  value: string;
  tone: "on" | "part" | "off";
}

const GLYPH: Record<Item["tone"], IconName> = { on: "check", part: "heuristic", off: "missed" };

export function coverageItems({ meta, validation }: Pick<ScenarioData, "meta" | "validation">): Item[] {
  const c = meta.coverage;
  return [
    {
      key: "area",
      label: "Area",
      value:
        c.aoi_source === "landfall"
          ? `Drawn around the landfall point${c.landfall_coast ? ` on the ${c.landfall_coast} coast` : ""}`
          : `Named area: ${meta.area}`,
      tone: "on",
    },
    { key: "hazard", label: "Flood and wind", value: "Modelled", tone: "on" },
    { key: "exposure", label: "People and buildings", value: "Counted in the flood", tone: "on" },
    {
      key: "shelters",
      label: "Shelters",
      value:
        c.shelters === "register"
          ? "OSDMA register"
          : c.shelters === "partial"
            ? "Register covers part of the area"
            : "No shelter register for this region",
      tone: c.shelters === "register" ? "on" : c.shelters === "partial" ? "part" : "off",
    },
    {
      key: "validation",
      label: "Satellite check",
      value:
        c.validation === "scored" && validation
          ? validation.passed
            ? `Passed · CSI ${validation.csi.toFixed(2)}`
            : `Failed · CSI ${validation.csi.toFixed(3)}`
          : c.validation === "not_requested"
            ? "Not run"
            : "Not scorable",
      tone: c.validation === "scored" && validation?.passed ? "on" : c.validation === "scored" ? "part" : "off",
    },
  ];
}

export function CoverageList({ data }: { data: Pick<ScenarioData, "meta" | "validation"> }): JSX.Element {
  return (
    <ul className={styles.list} aria-label="What this run covers">
      {coverageItems(data).map((item) => (
        <li key={item.key} className={styles.item[item.tone]}>
          <Icon name={GLYPH[item.tone]} size={12} />
          <span className={`${text.label} ${styles.label}`}>{item.label.toUpperCase()}</span>
          <span className={text.caption}>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
