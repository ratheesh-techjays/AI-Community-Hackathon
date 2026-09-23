import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type JSX } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { scenariosApi } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icon } from "@/components/Icon";
import { StatCardSkeleton, TableSkeleton } from "@/components/Skeleton";
import { text } from "@/design/typography.css";

import { toScenarioData, type RunBundle } from "./adapter";
import type { ScenarioData } from "./types";
import * as styles from "./useScenario.css";

/**
 * Scenario context.
 *
 * `ScenarioLayout` is the route element under /scenarios/:runId. It loads the
 * run from the API (an alias like `fani-2019-puri` or a UUID), adapts it once,
 * and provides it to every child screen. A run that does not exist renders an
 * honest "not computed" state — never an empty dashboard.
 */

const ScenarioContext = createContext<ScenarioData | null>(null);

/** Provides a run to screens. Used by the layout, and by tests with synthetic data. */
export const ScenarioProvider = ScenarioContext.Provider;

export function useScenario(): ScenarioData {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used under a /scenarios/:runId route");
  return ctx;
}

async function loadRun(runId: string): Promise<RunBundle> {
  const detail = await scenariosApi.get(runId);
  if (detail.status !== "COMPLETE") return { detail } as RunBundle;
  const [hazard, exposure, assets, decisions, parametric, validation, advisories] = await Promise.all([
    scenariosApi.hazard(runId),
    scenariosApi.exposure(runId),
    scenariosApi.assets(runId),
    scenariosApi.decisions(runId),
    scenariosApi.parametric(runId),
    scenariosApi.validation(runId),
    // A run computed without advisories is still a complete run.
    scenariosApi.advisories(runId).catch(() => null),
  ]);
  return { detail, hazard, exposure, assets, decisions, parametric, validation, advisories };
}

/** The run query, shared by the layout and the app shell (one request, one cache entry). */
export function useRunData(runId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.scenario(runId ?? ""),
    queryFn: () => loadRun(runId ?? ""),
    enabled: Boolean(runId),
    // A queued or running run is polled until it completes.
    refetchInterval: (q) => {
      const status = q.state.data?.detail.status;
      return status === "QUEUED" || status === "RUNNING" ? 3000 : false;
    },
    // 404 is an expected answer here, not an error-boundary crash.
    throwOnError: false,
  });
  const data = useMemo(
    () => (query.data?.detail.status === "COMPLETE" ? toScenarioData(query.data) : undefined),
    [query.data],
  );
  return { query, data };
}

export function ScenarioLayout(): JSX.Element {
  const { runId = "" } = useParams();
  const { query, data } = useRunData(runId);

  if (query.isPending) return <Loading />;
  if (query.isError) {
    const err = query.error;
    if (err instanceof ApiError && err.status === 404) return <NotComputed runId={runId} />;
    return <LoadFailed runId={runId} message={err instanceof Error ? err.message : String(err)} />;
  }

  const bundle = query.data;
  const status = bundle.detail.status;
  if (status === "QUEUED" || status === "RUNNING") {
    return <Computing stages={bundle.detail.stages_complete} />;
  }
  if (status === "FAILED") {
    return <LoadFailed runId={runId} message={bundle.detail.error ?? "The run failed."} />;
  }

  if (!data) return <Loading />;
  return (
    <ScenarioContext.Provider value={data}>
      <Outlet />
    </ScenarioContext.Provider>
  );
}

function Loading(): JSX.Element {
  return (
    <div className={styles.loading} aria-busy="true" aria-live="polite">
      <span className={text.label}>LOADING RUN</span>
      <div className={styles.loadingRow}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}

function Computing({ stages }: { stages: string[] }): JSX.Element {
  return (
    <div className={styles.empty} aria-live="polite">
      <Icon name="clock" size={24} />
      <h2 className={text.screenTitle}>Computing this scenario</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        Track, wind field, inundation, exposure and decisions run on Earth Engine data. This takes
        one to three minutes. Stages done: {stages.length ? stages.join(", ") : "starting"}.
      </p>
    </div>
  );
}

function LoadFailed({ runId, message }: { runId: string; message: string }): JSX.Element {
  return (
    <div className={styles.empty} role="alert">
      <Icon name="missed" size={24} />
      <h2 className={text.screenTitle}>Could not load run “{runId}”</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        {message} The backend may be offline; start it with <code>make dev</code> in{" "}
        <code>backend/</code>.
      </p>
      <Link to="/" className={styles.emptyLink}>
        Back to storms
      </Link>
    </div>
  );
}

function NotComputed({ runId }: { runId: string }): JSX.Element {
  return (
    <div className={styles.empty}>
      <Icon name="clock" size={24} />
      <h2 className={text.screenTitle}>No computed run for “{runId}”</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        This scenario has not been modelled yet. A run is a backend job — track ingestion, wind
        field, inundation, exposure, decisions — and takes one to three minutes. Start one from the
        storm list, or open the precomputed Fani run.
      </p>
      <Link to="/" className={styles.emptyLink}>
        Back to storms
      </Link>
    </div>
  );
}
