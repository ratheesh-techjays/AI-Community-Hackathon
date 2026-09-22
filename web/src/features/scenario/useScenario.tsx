import { createContext, useContext, type JSX } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { Icon } from "@/components/Icon";
import { text } from "@/design/typography.css";

import { SCENARIOS } from "./registry";
import type { ScenarioData } from "./types";
import * as styles from "./useScenario.css";

/**
 * Scenario context.
 *
 * `ScenarioLayout` is the route element under /scenarios/:runId. It resolves
 * the run, provides it to every child screen, and renders an honest
 * "not computed" state when no run exists — never an empty dashboard.
 *
 * `useScenario()` is what screens call. They no longer import fixtures.
 *
 * TODO(frontend): when GET /scenarios/{runId} ships, resolve via TanStack
 * Query here and keep the registry only for the precomputed demo runs.
 */

const ScenarioContext = createContext<ScenarioData | null>(null);

export function useScenario(): ScenarioData {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used under a /scenarios/:runId route");
  return ctx;
}

export function ScenarioLayout(): JSX.Element {
  const { runId = "" } = useParams();
  const data = SCENARIOS[runId];

  if (!data) {
    return <NotComputed runId={runId} />;
  }

  return (
    <ScenarioContext.Provider value={data}>
      <Outlet />
    </ScenarioContext.Provider>
  );
}

function NotComputed({ runId }: { runId: string }): JSX.Element {
  return (
    <div className={styles.empty}>
      <Icon name="clock" size={24} />
      <h2 className={text.screenTitle}>No computed run for “{runId}”</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        This scenario has not been modelled yet. A run is a backend job — track ingestion, wind
        field, inundation, exposure, decisions — and takes 30 seconds to a few minutes. Start one
        from the storm list, or open the precomputed Fani run.
      </p>
      <Link to="/" className={styles.emptyLink}>
        Back to storms
      </Link>
    </div>
  );
}
