import { createBrowserRouter, Navigate } from "react-router-dom";

import { ActionQueueScreen } from "@/features/queue/ActionQueueScreen";
import { StormSelectorScreen } from "@/features/scenario/StormSelectorScreen";
import { ScenarioLayout } from "@/features/scenario/useScenario";
import { SheltersScreen } from "@/features/shelters/SheltersScreen";
import { SituationScreen } from "@/features/situation/SituationScreen";
import { ValidationScreen } from "@/features/validation/ValidationScreen";

import { AppShell } from "./AppShell";

/**
 * A scenario is addressable. /scenarios/:runId/… means a run can be shared,
 * bookmarked, and swapped for another storm without touching a screen.
 *
 *   /                              storm selector
 *   /scenarios/:runId              → orders
 *   /scenarios/:runId/orders       the queue (home for a run)
 *   /scenarios/:runId/map
 *   /scenarios/:runId/shelters
 *   /scenarios/:runId/evidence
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <StormSelectorScreen /> },
      {
        path: "scenarios/:runId",
        element: <ScenarioLayout />,
        children: [
          { index: true, element: <Navigate to="orders" replace /> },
          { path: "orders", element: <ActionQueueScreen /> },
          { path: "map", element: <SituationScreen /> },
          { path: "shelters", element: <SheltersScreen /> },
          { path: "evidence", element: <ValidationScreen /> },
        ],
      },
    ],
  },
]);
