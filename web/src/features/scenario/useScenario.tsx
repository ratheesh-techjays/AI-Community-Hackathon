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
    const t = bundle.detail.request.track;
    return (
      <Computing
        storm={t.storm_name ? `${t.storm_name.charAt(0)}${t.storm_name.slice(1).toLowerCase()} ${t.season ?? ""}` : "this storm"}
        stages={bundle.detail.stages_complete}
        steps={bundle.detail.request.generate_advisories ? STEPS : STEPS.filter((s) => s.id !== "ai.advisories")}
      />
    );
  }
  if (status === "FAILED") {
    return <RunFailed error={bundle.detail.error ?? "The run failed."} />;
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

/** Pipeline stages in run order, named for a reader rather than a log. */
const STEPS: { id: string; label: string }[] = [
  { id: "hazard.wind_field", label: "Wind field from the best track" },
  { id: "hazard.inundation", label: "Surge and flood on the elevation model" },
  { id: "exposure", label: "People and buildings in the flood" },
  { id: "decision.assignment", label: "Shelter check and assignment" },
  { id: "decision.parametric_and_packets", label: "Orders and parametric trigger" },
  { id: "validation.sar", label: "Satellite check" },
  { id: "ai.advisories", label: "Stage briefings" },
];

function Computing({
  storm,
  stages,
  steps,
}: {
  storm: string;
  stages: string[];
  steps: { id: string; label: string }[];
}): JSX.Element {
  const done = new Set(stages);
  const current = steps.find((s) => !done.has(s.id))?.id;
  return (
    <div className={styles.empty} aria-live="polite" aria-busy="true">
      <Icon name="clock" size={24} />
      <h2 className={text.screenTitle}>Modelling Cyclone {storm}</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        Every step runs on real Earth Engine data, so this takes one to three minutes. This page
        opens the run by itself when it is done.
      </p>
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li
            key={s.id}
            className={done.has(s.id) ? styles.stepDone : s.id === current ? styles.stepNow : styles.stepTodo}
          >
            <Icon name={done.has(s.id) ? "check" : "clock"} size={12} />
            <span className={text.body}>{s.label}</span>
            {s.id === current ? <span className={`${text.caption} ${styles.stepNote}`}>running…</span> : null}
          </li>
        ))}
      </ol>
      <Link to="/" className={styles.emptyLink}>
        Back to storms
      </Link>
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

/** A run that failed on the backend: the problem slug in plain words, never a stack trace. */
function RunFailed({ error }: { error: string }): JSX.Element {
  const [slug, ...rest] = error.split(": ");
  const detail = rest.join(": ");
  const plain = new ApiError({
    status: 500,
    type: `https://prahari.dev/problems/${slug ?? ""}`,
    title: "The run failed",
    requestId: "",
  }).plain;
  return (
    <div className={styles.empty} role="alert">
      <Icon name="missed" size={24} />
      <h2 className={text.screenTitle}>This run could not be completed</h2>
      <p className={`${text.body} ${styles.emptyBody}`}>
        {plain === "The run failed" ? error : `${plain} ${detail}`}
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
