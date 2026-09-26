import { lazy, Suspense, type JSX, type LazyExoticComponent } from "react";
import { createBrowserRouter, Link, Navigate } from "react-router-dom";

import { Callout } from "@/components/Callout";
import { TableSkeleton } from "@/components/Skeleton";
import { ScenarioLayout } from "@/features/scenario/useScenario";

import { AppShell } from "./AppShell";

/**
 * A scenario is addressable. /scenarios/:runId/… means a run can be shared,
 * bookmarked, and swapped for another storm without touching a screen.
 *
 *   /                              storm selector
 *   /scenarios/:runId              → overview
 *   /scenarios/:runId/overview     what will happen: summary, map, next step (home for a run)
 *   /scenarios/:runId/orders       the queue: what to order, who, by when
 *   /scenarios/:runId/map          → overview (old links)
 *   /scenarios/:runId/shelters
 *   /scenarios/:runId/evidence
 *
 * Screens are split per route: the first paint ships only the shell and the
 * screen being opened.
 */

const named = <K extends string>(
  load: () => Promise<Record<K, () => JSX.Element>>,
  key: K,
): LazyExoticComponent<() => JSX.Element> => lazy(() => load().then((m) => ({ default: m[key] })));

const StormSelectorScreen = named(() => import("@/features/scenario/StormSelectorScreen"), "StormSelectorScreen");
const ActionQueueScreen = named(() => import("@/features/queue/ActionQueueScreen"), "ActionQueueScreen");
const SituationScreen = named(() => import("@/features/situation/SituationScreen"), "SituationScreen");
const SheltersScreen = named(() => import("@/features/shelters/SheltersScreen"), "SheltersScreen");
const ValidationScreen = named(() => import("@/features/validation/ValidationScreen"), "ValidationScreen");

function screen(Screen: LazyExoticComponent<() => JSX.Element>): JSX.Element {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <Screen />
    </Suspense>
  );
}

function NotFound(): JSX.Element {
  return (
    <Callout intent="info" title="No such page">
      This address is not part of PRAHARI. <Link to="/">Back to storms</Link>
    </Callout>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: screen(StormSelectorScreen) },
      {
        path: "scenarios/:runId",
        element: <ScenarioLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview", element: screen(SituationScreen) },
          { path: "map", element: <Navigate to="../overview" replace /> },
          { path: "orders", element: screen(ActionQueueScreen) },
          { path: "shelters", element: screen(SheltersScreen) },
          { path: "evidence", element: screen(ValidationScreen) },
          { path: "*", element: <NotFound /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
