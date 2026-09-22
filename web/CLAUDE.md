# CLAUDE.md: web

React 19 frontend built with Vite 5, TypeScript strict, vanilla-extract, TanStack Query v5 and React Router 6. Run every command from `web/`. See the root `CLAUDE.md` for cross-cutting rules.

## Commands
- `npm install`, then `npm run dev`. The dev server runs on :5173 and proxies `/api` to `localhost:8080`, where the backend's `make dev` listens.
- `npm run check`: runs `typecheck`, then `lint` (eslint `--max-warnings 0`, so any warning fails), then `lint:css` (stylelint on `src/**/*.css.ts`), then `test` (vitest). Run it before calling frontend work done.
- Single test file: `npx vitest run tests/orderLedger.test.tsx`. Single test: `npx vitest run -t "test name"`.
- `npm run build`: runs `tsc -b` and then the vite build.
- API types:
  - `npm run api:types` regenerates `src/api/generated/schema.d.ts` from the running backend.
  - `npm run api:check` fails when the regenerated types differ from what is committed.
  - The generated directory is ignored by eslint.

Tests run under jsdom with vitest globals (`tests/setup.ts` loads jest-dom). They live in `web/tests/`, not next to the source.

## TypeScript
- Beyond `strict`, the compiler enables:
  - `noUncheckedIndexedAccess`: indexing returns `T | undefined`;
  - `exactOptionalPropertyTypes`: optional props need `| undefined` if `undefined` is ever passed;
  - `verbatimModuleSyntax`: type-only imports must use `import type`, and ESLint `consistent-type-imports` enforces it.
- ESLint uses `strictTypeChecked`.
- The `@/` alias maps to `src/`.

## Architecture
- **Entry:** `app/main.tsx` imports `@/design` once (themes and reset), then renders `Providers` and `RouterProvider`.
  - `Providers` supplies the QueryClient and the `OrderLedgerProvider`.
  - It also prefetches the runs listed in `VITE_DEMO_RUN_IDS`.
- **Routes** (`app/router.tsx`):
  - `/` is the storm selector.
  - `/scenarios/:runId/{orders,map,shelters,evidence}` sits under `ScenarioLayout`. The index route redirects to `orders`.
- **Feature slices** live in `features/<name>/`:
  - `scenario`, `queue`, `situation`, `shelters`, `validation` and `orders` are the feature slices.
  - Shared presentational components live in `components/`.
- **Scenario data (current state):**
  - `ScenarioLayout` (`features/scenario/useScenario.tsx`) resolves `runId` through `features/scenario/registry.ts`.
  - The registry maps run ids to the fixtures in `features/fixtures/` (`fani.ts`, `actions.ts`, `disclosures.ts`).
  - Screens read everything from `useScenario()`, whose shape is `ScenarioData` in `features/scenario/types.ts`, and **must not import fixtures directly**.
  - An unknown `runId` renders an honest "not computed" state, never an empty dashboard.
  - When the backend is live, `useScenario` will switch to TanStack Query and the registry will keep only the precomputed demo runs.
- **Order ledger** (`features/orders/orderLedger.tsx`):
  - A ticked checkbox is an auditable order: `subjectId`, `action`, IMD `stage`, `orderedAt` and `byRole`.
  - `orderedAt` is recorded at the moment of the tick, never derived later.
  - Writes are optimistic and persisted to localStorage (`prahari.orders.v1`) until `POST /scenarios/{id}/orders` exists.
  - Storage failures must never block an in-memory write.
  - Times are shown in 24-hour IST (`formatIST`).
- **Map** (`map/ImpactMap.tsx`):
  - Currently a hand-drawn schematic SVG that is labelled as such in the UI.
  - `deck.gl` and `maplibre-gl` are installed, and `vite.config.ts` already splits them into a separate `map` chunk. When the real layers land, keep them out of the initial bundle.
  - Map encodings must never rely on hue alone:
    - flood bands carry a pattern as well as a hue;
    - wind bands are outlines;
    - compromised shelters get a halo, a distinct shape and a label.

## Transport and data fetching (`api/`)
- `api/client.ts` is the **only** place `fetch` is allowed. ESLint bans the global `fetch` and `window.fetch` everywhere else. Use `apiClient.get`, `post` and `delete`.
- Request, response and error interceptors are registered once in `client.ts`:
  - request id (`X-Request-Id`, correlated with the backend);
  - `X-Prahari-Key` from `VITE_PRAHARI_KEY`;
  - retry;
  - dev telemetry.
- **Retry lives only in the transport:**
  - It honours `Retry-After`, then falls back to exponential backoff, for up to 3 attempts.
  - It never retries `hazard-model-error`.
  - The QueryClient sets `retry: false` for queries and mutations. Don't add retry at the query level.
- `api/errors.ts` turns problem+json into an `ApiError`, which exposes:
  - `i18nKey`, from the `PROBLEM_I18N` map of `type` URIs;
  - `isRetriable`;
  - `isHazardModelError`;
  - `isTruthUnavailable`.
- A new backend error slug needs an entry in `PROBLEM_I18N`.
- `queryClient.ts`:
  - `staleTime` is 5 minutes, because completed runs are immutable and content-addressed.
  - Errors with status ≥500 throw to the error boundary.
- Always build query keys with `api/queryKeys.ts`. Never inline a key. The keys are hierarchical under `scenario(id)`, so invalidating a run drops all of its child queries.
- `api/endpoints/index.ts` has hand-written interfaces that mirror the backend models. The plan is to replace them with generated `components["schemas"][...]` types.

## Design system (`design/`), strictly lint-enforced
- `design/tokens/source.ts` transcribes the published design system. It is the **only** file allowed to contain raw hex colors or `px`/`em`/`ms` literals.
- `tokens/contract.css.ts` is the typed theme contract (`vars`), built with `createGlobalThemeContract`. A theme that misses a token fails to compile.
- `tokens/themes.css.ts` implements the light and dark themes.
- Components use:
  - `vars.*`;
  - `text` and `labelCaps` (typography);
  - the `flood`, `wind` and `validation` patterns;
  - `sprinkles`.
- ESLint `no-restricted-syntax` rules:
  - **In `.tsx` and `.ts` files:** no hex colors, no `px`/`em`/`ms` literals, and no inline `style={...}`. The one exception is `style={assignInlineVars(...)}`, which is how runtime values reach CSS.
  - **In `*.css.ts` files:** raw layout lengths are allowed and raw colors are not.
  - **In `src/map/**`:** raw colors are banned.
- Stylelint requires tokens for color, background, border, shadow, z-index, font-*, line-height, margin, padding, gap, radius and durations. The allowed plain values are `0`, `auto`, `100%`, `none`, `inherit`, `transparent` and `currentColor`.
- `tests/designSystem.test.ts` guards invariants in `source.ts`. Keep them intact:
  - IMD stage colors are identical in both themes, because they are IMD's color code.
  - `text.onDark` stays white.
  - Flood bands are stable across themes, except the deep band.
  - Odia (`*Od`) styles have more leading than their English pairs and no letter-spacing.

## Disclosure in the UI
- Every modelled number must render with a `DisclosureBadge` (`components/DisclosureBadge.tsx`). `StatCard`, `MetricStrip` and `DataTable` accept disclosure props for this.
- Fixture disclosures and limitations live in `features/fixtures/disclosures.ts`.
- `types/disclosed.ts` defines the `Disclosed<T>` brand, `disclose()`, `unsafeUnwrap(d, reason)` (which warns in dev) and `disclosureVariant()`.
  - Wrap API data at the query boundary once live endpoints are wired.
  - `<DisclosedValue>` is referenced in the comments but does not exist yet.

## Environment (`.env.example`)
- `VITE_API_BASE`: defaults to `/api/v1`.
- `VITE_PRAHARI_KEY`: an optional key for write endpoints.
- `VITE_DEMO_RUN_IDS`: comma-separated run ids to prefetch.
- `i18next` and `react-i18next` are installed but not initialized yet. Error i18n keys already exist on `ApiError`.
