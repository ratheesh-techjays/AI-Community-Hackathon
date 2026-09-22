import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type JSX, type ReactNode } from "react";

import { queryClient } from "@/api/queryClient";
import { OrderLedgerProvider } from "@/features/orders/orderLedger";
import { queryKeys } from "@/api/queryKeys";
import { scenariosApi } from "@/api/endpoints";

/**
 * Demo runs are precomputed on the backend's hot tier. Prefetching them here
 * makes the live demo a cache hit in the browser as well as on the server,
 * so nothing depends on venue wifi at the moment it matters.
 */
const DEMO_RUN_IDS = (import.meta.env.VITE_DEMO_RUN_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function DemoPrefetch(): null {
  useEffect(() => {
    for (const runId of DEMO_RUN_IDS) {
      // `query` replaced both prefetchQuery and fetchQuery in TanStack Query v5.
      void queryClient
        .query({
          queryKey: queryKeys.scenario(runId),
          queryFn: () => scenariosApi.get(runId),
        })
        .catch(() => undefined);
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <OrderLedgerProvider>
        <DemoPrefetch />
        {children}
      </OrderLedgerProvider>
    </QueryClientProvider>
  );
}
