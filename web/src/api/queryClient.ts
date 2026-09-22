import { QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "./errors";

/**
 * THE SINGLE CACHE POLICY.
 *
 * `retry: false` is deliberate. Retry semantics (Retry-After, the
 * hazard-model-error exception) live in the transport interceptor chain.
 * Two stacked retry systems multiply requests.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Completed scenario runs are immutable and content-addressed,
      // so they can be cached hard.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      throwOnError: (error) => error instanceof ApiError && error.status >= 500,
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.["silent"]) return;
      if (import.meta.env.DEV) {
        console.error("[query]", query.queryHash, error);
      }
      // TODO(frontend): surface via toast using ApiError.i18nKey
    },
  }),
});
