# PRAHARI — Frontend Architecture

**Version** 1.0 · **Date** 2026-09-22
**Stack** React 19 + TypeScript (strict) · Vite · TanStack Query v5 · vanilla-extract · deck.gl + MapLibre · i18next

---

## 1. Architectural stance

> **The frontend's job is to make our caveats impossible to drop.**

The backend enforces honesty through the type system — `SurgeEstimateOut.model_class` is a `Literal["heuristic_index"]`, `InundationOut.connectivity_enforced` is `Literal[True]`, and contract tests C1–C6 fail the build if a modelled number serialises without its `ModelDisclosure`. **That guarantee is worthless if the UI renders the number and discards the disclosure.**

So the frontend mirrors the backend's discipline with four principles:

| Principle | Mechanism |
|---|---|
| **F1 — A modelled number cannot render without its disclosure** | `Disclosed<T>` type + `<DisclosedValue>` component. Raw access to a modelled figure is a type error. |
| **F2 — Zero hardcoded design values** | Three-tier token contract in vanilla-extract. A raw hex, px, or ms value fails lint *and* compile. |
| **F3 — One transport layer, one cache policy** | Single `apiClient` with interceptors; single `QueryClient`; single query-key factory. No `fetch()` calls in components, ever. |
| **F4 — Types are generated, never hand-written** | `openapi-typescript` against FastAPI's OpenAPI schema. Backend contract drift becomes a compile error, not a runtime surprise. |

---

## 2. Repository layout — feature-sliced

```
web/
├── src/
│   ├── app/                        # composition root only
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx           # QueryClient, i18n, theme, error boundary
│   │   └── routes/
│   ├── design/                     # ⭐ the token system — F2
│   │   ├── tokens/
│   │   │   ├── contract.css.ts     # createGlobalThemeContract — the shape
│   │   │   ├── primitive.ts        # raw scales (the ONLY place literals live)
│   │   │   ├── light.css.ts        # theme implementations
│   │   │   ├── dark.css.ts
│   │   │   └── hazard.ts           # domain-semantic scales (flood depth, wind, severity)
│   │   ├── recipes/                # sprinkles + component recipes
│   │   ├── reset.css.ts
│   │   └── index.ts
│   ├── api/                        # ⭐ the transport layer — F3
│   │   ├── client.ts               # apiClient + interceptor pipeline
│   │   ├── interceptors/
│   │   │   ├── requestId.ts
│   │   │   ├── auth.ts
│   │   │   ├── problemJson.ts      # RFC 9457 → typed ApiError
│   │   │   ├── retry.ts
│   │   │   └── telemetry.ts
│   │   ├── queryClient.ts          # single QueryClient config
│   │   ├── queryKeys.ts            # single key factory
│   │   ├── generated/schema.d.ts   # ⭐ openapi-typescript output — never edited
│   │   └── endpoints/              # thin typed wrappers per resource
│   ├── features/
│   │   ├── scenario/               # create, poll, SSE progress
│   │   ├── hazard/                 # surge + inundation display
│   │   ├── exposure/               # tables, rollups
│   │   ├── shelters/               # ⭐ compromised-shelter view
│   │   ├── decisions/              # assignments + unassigned clusters
│   │   ├── advisories/             # role × stage × language
│   │   ├── parametric/             # trigger + payout
│   │   ├── validation/             # ⭐ the eval panel
│   │   └── provenance/             # sources + limitations
│   ├── map/
│   │   ├── MapCanvas.tsx
│   │   ├── layers/                 # one module per deck.gl layer
│   │   ├── useLayerRegistry.ts
│   │   └── legend/
│   ├── components/                 # primitives: Button, Table, Badge, Callout…
│   ├── hooks/
│   ├── lib/                        # formatters, guards, units
│   ├── i18n/
│   │   └── locales/{en,or}/
│   └── types/
│       └── disclosed.ts            # ⭐ Disclosed<T> — F1
├── tests/
└── ...
```

**Rule:** `features/*` may import from `components`, `design`, `api`, `lib`, `hooks`. They may **not** import from each other. Cross-feature composition happens in `app/routes`. Enforced by `eslint-plugin-boundaries`.

---

## 3. Design token system (F2)

### Three tiers, one direction of dependency

```
primitive.ts          →   contract.css.ts        →   components
(raw scales:              (semantic names:            (consume semantic
 blue.500, space.4)        surface.raised,             tokens only)
                           text.muted)
```

⭐ **`primitive.ts` is the only file in the codebase permitted to contain a raw colour, length, or duration literal.** Everything else references tokens. This is enforced, not aspirational.

```ts
// design/tokens/primitive.ts — the single source of literals
export const primitive = {
  color: {
    slate: { 50: '#f8fafc', 100: '#f1f5f9', /* … */ 900: '#0f172a' },
    blue:  { 500: '#3b82f6', 600: '#2563eb' },
    amber: { 400: '#fbbf24', 500: '#f59e0b' },
    red:   { 500: '#ef4444', 600: '#dc2626' },
    cyan:  { 300: '#67e8f9', 500: '#06b6d4', 700: '#0e7490' },
  },
  space:  { 0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 6: '1.5rem', 8: '2rem' },
  radius: { sm: '0.25rem', md: '0.5rem', lg: '0.75rem', full: '9999px' },
  font: {
    family: { sans: "'Inter Variable', system-ui, sans-serif", mono: "'JetBrains Mono', monospace" },
    size:   { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.5rem', '2xl': '2rem' },
    weight: { regular: '400', medium: '500', semibold: '600' },
    leading:{ tight: '1.25', normal: '1.5', relaxed: '1.7' },
  },
  duration: { instant: '0ms', fast: '120ms', normal: '200ms', slow: '320ms' },
  easing:   { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
  z:        { base: '0', map: '10', panel: '20', overlay: '30', toast: '40' },
  shadow:   { sm: '0 1px 2px rgb(0 0 0 / 0.06)', md: '0 4px 12px rgb(0 0 0 / 0.10)' },
} as const;
```

### The contract — themeable by construction

```ts
// design/tokens/contract.css.ts
import { createGlobalThemeContract } from '@vanilla-extract/css';

export const vars = createGlobalThemeContract({
  color: {
    surface:     { base: '', raised: '', sunken: '', overlay: '' },
    text:        { primary: '', secondary: '', muted: '', inverse: '', link: '' },
    border:      { subtle: '', default: '', strong: '', focus: '' },
    intent: {
      info: '', success: '', warning: '', danger: '',
      infoSurface: '', warningSurface: '', dangerSurface: '',
    },
    // ⭐ domain-semantic — hazard visualisation is part of the design system,
    //    not ad-hoc colours chosen per chart
    hazard: {
      floodShallow: '', floodModerate: '', floodDeep: '',
      windLow: '', windModerate: '', windSevere: '', windExtreme: '',
      compromised: '',          // shelter inside surge zone
      observedTruth: '',        // SAR observed extent
      predicted: '',            // model prediction
      agreement: '', falseAlarm: '', miss: '',   // confusion-matrix overlay
    },
  },
  space: { 0:'',1:'',2:'',3:'',4:'',6:'',8:'' },
  radius:{ sm:'', md:'', lg:'', full:'' },
  font:  { family:{sans:'',mono:''}, size:{xs:'',sm:'',md:'',lg:'',xl:'','2xl':''},
           weight:{regular:'',medium:'',semibold:''}, leading:{tight:'',normal:'',relaxed:''} },
  duration:{ instant:'',fast:'',normal:'',slow:'' },
  easing:{ standard:'' },
  z:{ base:'',map:'',panel:'',overlay:'',toast:'' },
  shadow:{ sm:'',md:'' },
}, (_v, path) => `prahari-${path.join('-')}`);
```

```ts
// design/tokens/light.css.ts
import { createGlobalTheme } from '@vanilla-extract/css';
import { vars } from './contract.css';
import { primitive as p } from './primitive';

createGlobalTheme(':root', vars, {
  color: {
    surface: { base: p.color.slate[50], raised: '#ffffff',
               sunken: p.color.slate[100], overlay: 'rgb(15 23 42 / 0.6)' },
    text:    { primary: p.color.slate[900], secondary: p.color.slate[700],
               muted: p.color.slate[500], inverse: '#ffffff', link: p.color.blue[600] },
    border:  { subtle: p.color.slate[100], default: p.color.slate[200],
               strong: p.color.slate[400], focus: p.color.blue[500] },
    intent:  { info: p.color.blue[600], success: '#16a34a',
               warning: p.color.amber[500], danger: p.color.red[600],
               infoSurface: '#eff6ff', warningSurface: '#fffbeb', dangerSurface: '#fef2f2' },
    hazard:  {
      floodShallow: p.color.cyan[300], floodModerate: p.color.cyan[500], floodDeep: p.color.cyan[700],
      windLow: '#fde68a', windModerate: p.color.amber[500], windSevere: '#ea580c', windExtreme: p.color.red[600],
      compromised: p.color.red[600],
      observedTruth: '#7c3aed', predicted: p.color.cyan[500],
      agreement: '#16a34a', falseAlarm: p.color.amber[500], miss: p.color.red[600],
    },
  },
  space: p.space, radius: p.radius, font: p.font,
  duration: p.duration, easing: p.easing, z: p.z, shadow: p.shadow,
});
```

> ⭐ **Why hazard colours are tokens.** A flood-depth ramp is a *semantic* decision with accessibility and colour-blindness consequences, not a per-chart aesthetic choice. Putting it in the contract means the map, the legend, the table badges, and the validation overlay are guaranteed consistent — and a colour-blind-safe palette is one theme swap away.

### Enforcement — no hardcoded values, no inline CSS

```jsonc
// .stylelintrc.json
{
  "plugins": ["stylelint-declaration-strict-value"],
  "rules": {
    "scale-unlimited/declaration-strict-value": [
      ["/color/", "background", "border", "box-shadow", "z-index",
       "font-size", "font-family", "font-weight", "line-height",
       "/^margin/", "/^padding/", "gap", "/^border-radius/",
       "transition-duration", "animation-duration"],
      { "ignoreValues": ["inherit","currentColor","transparent","none","0","auto","100%"],
        "disableFix": true }
    ]
  }
}
```

```js
// eslint.config.js — the rules that matter
rules: {
  // ⭐ no inline CSS, ever
  'react/forbid-dom-props': ['error', { forbid: ['style'] }],
  'react/no-unknown-property': ['error', { ignore: [] }],

  // ⭐ primitive literals only in design/tokens/primitive.ts
  'no-restricted-syntax': ['error', {
    selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,8})$/]",
    message: 'Raw colour literal. Use vars.color.* from the token contract.',
  }, {
    selector: "Literal[value=/^\\d+(px|rem|em|ms)$/]",
    message: 'Raw dimension literal. Use vars.space/radius/font/duration.',
  }],

  // architectural boundaries
  'boundaries/element-types': ['error', { /* features cannot import features */ }],

  // ⭐ no transport outside the api layer
  'no-restricted-globals': ['error', { name: 'fetch', message: 'Use apiClient from @/api/client.' }],
}
```
```js
// overrides
{ files: ['src/design/tokens/primitive.ts'], rules: { 'no-restricted-syntax': 'off' } }
{ files: ['src/api/client.ts'],              rules: { 'no-restricted-globals': 'off' } }
```

> **`style` prop is banned with one deliberate exception:** deck.gl and MapLibre require imperative style objects for canvas rendering. Those live in `map/layers/*` and read **exclusively** from token values resolved via a typed helper — never literals. See §7.

### Sprinkles for layout

```ts
// design/recipes/sprinkles.css.ts
const responsive = defineProperties({
  conditions: { base: {}, sm: { '@media': 'screen and (min-width: 640px)' },
                lg: { '@media': 'screen and (min-width: 1024px)' } },
  defaultCondition: 'base',
  properties: {
    display: ['none','flex','grid','block'],
    flexDirection: ['row','column'],
    alignItems: ['flex-start','center','stretch','flex-end'],
    justifyContent: ['flex-start','center','space-between','flex-end'],
    gap: vars.space, padding: vars.space, paddingInline: vars.space,
    paddingBlock: vars.space, marginBlock: vars.space,
    gridTemplateColumns: { 1:'1fr', 2:'repeat(2,1fr)', 3:'repeat(3,1fr)', sidebar:'320px 1fr' },
  },
});
export const sprinkles = createSprinkles(responsive);
```

---

## 4. Transport layer (F3)

### `api/client.ts` — the single centralized file

```ts
import { ApiError, toApiError } from './errors';
import { interceptors } from './interceptors';

export interface RequestContext {
  url: string;
  init: RequestInit;
  meta: { requestId: string; startedAt: number; attempt: number };
}

export type RequestInterceptor  = (ctx: RequestContext) => Promise<RequestContext> | RequestContext;
export type ResponseInterceptor = (res: Response, ctx: RequestContext) => Promise<Response> | Response;
export type ErrorInterceptor    = (err: unknown, ctx: RequestContext) => Promise<never | Response>;

class ApiClient {
  private readonly requestChain: RequestInterceptor[] = [];
  private readonly responseChain: ResponseInterceptor[] = [];
  private readonly errorChain: ErrorInterceptor[] = [];

  use(i: { request?: RequestInterceptor; response?: ResponseInterceptor; error?: ErrorInterceptor }) {
    if (i.request)  this.requestChain.push(i.request);
    if (i.response) this.responseChain.push(i.response);
    if (i.error)    this.errorChain.push(i.error);
    return this;
  }

  async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    let ctx: RequestContext = {
      url: `${import.meta.env.VITE_API_BASE}${path}`,
      init: { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } },
      meta: { requestId: crypto.randomUUID(), startedAt: performance.now(), attempt },
    };

    for (const fn of this.requestChain) ctx = await fn(ctx);

    try {
      let res = await fetch(ctx.url, ctx.init);
      for (const fn of this.responseChain) res = await fn(res, ctx);
      if (!res.ok) throw await toApiError(res, ctx);          // ⭐ RFC 9457 → typed
      return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    } catch (err) {
      for (const fn of this.errorChain) {
        const recovered = await fn(err, ctx).catch(e => { throw e; });
        if (recovered instanceof Response) return (await recovered.json()) as T;
      }
      throw err;
    }
  }

  get  = <T>(p: string, i?: RequestInit) => this.request<T>(p, { ...i, method: 'GET' });
  post = <T>(p: string, body?: unknown, i?: RequestInit) =>
    this.request<T>(p, { ...i, method: 'POST', body: body ? JSON.stringify(body) : undefined });
  del  = <T>(p: string) => this.request<T>(p, { method: 'DELETE' });
}

export const apiClient = new ApiClient()
  .use(interceptors.requestId)
  .use(interceptors.auth)
  .use(interceptors.problemJson)
  .use(interceptors.retry)
  .use(interceptors.telemetry);
```

### The interceptors

```ts
// interceptors/requestId.ts — correlate with backend RequestIDMiddleware
export const requestId = {
  request: (ctx) => {
    (ctx.init.headers as Record<string,string>)['X-Request-Id'] = ctx.meta.requestId;
    return ctx;
  },
};

// interceptors/problemJson.ts — RFC 9457 → typed, i18n-ready errors
export async function toApiError(res: Response, ctx: RequestContext): Promise<ApiError> {
  const isProblem = res.headers.get('content-type')?.includes('application/problem+json');
  const body = isProblem ? await res.json().catch(() => null) : null;
  return new ApiError({
    status: res.status,
    type: body?.type ?? 'about:blank',
    title: body?.title ?? res.statusText,
    detail: body?.detail,
    fieldErrors: body?.errors ?? undefined,
    requestId: ctx.meta.requestId,
    // ⭐ maps backend problem types to i18n keys, so error copy is translatable
    i18nKey: PROBLEM_I18N[body?.type] ?? 'errors.unexpected',
  });
}

// interceptors/retry.ts — respects Retry-After on 429 (GEE/Gemini quota)
export const retry = {
  error: async (err: unknown, ctx: RequestContext) => {
    if (!(err instanceof ApiError)) throw err;
    const retriable = err.status === 429 || err.status === 503 || err.status >= 500;
    // ⭐ never retry 500 hazard-model-error — the science failed, not the network
    if (err.type.endsWith('/hazard-model-error')) throw err;
    if (!retriable || ctx.meta.attempt >= 2) throw err;
    const after = Number(err.retryAfter ?? 0);
    const delay = after > 0 ? after * 1000 : 2 ** ctx.meta.attempt * 400 + Math.random() * 200;
    await sleep(delay);
    return apiClient.request(stripBase(ctx.url), ctx.init, ctx.meta.attempt + 1) as never;
  },
};

// interceptors/telemetry.ts
export const telemetry = {
  response: (res, ctx) => {
    track('api_call', { path: new URL(ctx.url).pathname, status: res.status,
                        ms: Math.round(performance.now() - ctx.meta.startedAt),
                        attempt: ctx.meta.attempt, requestId: ctx.meta.requestId });
    return res;
  },
};
```

> ⭐ **The retry interceptor encodes a backend design decision.** The API deliberately returns `500 hazard-model-error` when the science fails, because *we will serve a worse sentence, never a wrong number*. Retrying that would be pointless and would mask a real failure. The interceptor knows the difference between a transport problem and a model problem.

### `api/queryClient.ts` — one cache policy

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,      // scenario results are immutable — cache hard
      gcTime: 30 * 60_000,
      retry: false,               // ⭐ retry lives in the interceptor, not here
      refetchOnWindowFocus: false,
      throwOnError: (error) => error instanceof ApiError && error.status >= 500,
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return;
      toast.error(resolveErrorMessage(error));   // i18n key → localized copy
    },
  }),
});
```

**Deliberate:** `retry: false` in TanStack Query. Retry semantics (Retry-After, the hazard-error exception) belong in one place — the transport layer. Two retry systems stacked is how you get eight requests from one click.

### `api/queryKeys.ts` — one key factory

```ts
export const queryKeys = {
  all: ['prahari'] as const,

  storms: () => [...queryKeys.all, 'storms'] as const,
  storm:  (sid: string) => [...queryKeys.storms(), sid] as const,
  track:  (sid: string) => [...queryKeys.storm(sid), 'track'] as const,

  scenarios: () => [...queryKeys.all, 'scenarios'] as const,
  scenario:  (id: string) => [...queryKeys.scenarios(), id] as const,
  hazard:     (id: string) => [...queryKeys.scenario(id), 'hazard'] as const,
  exposure:   (id: string, p: ExposureParams) => [...queryKeys.scenario(id), 'exposure', p] as const,
  assets:     (id: string, p: AssetParams)    => [...queryKeys.scenario(id), 'assets', p] as const,
  decisions:  (id: string) => [...queryKeys.scenario(id), 'decisions'] as const,
  advisories: (id: string, p: AdvisoryParams) => [...queryKeys.scenario(id), 'advisories', p] as const,
  parametric: (id: string) => [...queryKeys.scenario(id), 'parametric'] as const,
  validation: (id: string) => [...queryKeys.scenario(id), 'validation'] as const,

  shelters: (p: ShelterParams) => [...queryKeys.all, 'shelters', p] as const,
  meta:     { sources: () => [...queryKeys.all,'meta','sources'] as const,
              limitations: () => [...queryKeys.all,'meta','limitations'] as const },
  evals:    (suite?: string) => [...queryKeys.all, 'evals', suite ?? 'all'] as const,
} as const;
```

### Generated types (F4)

```jsonc
// package.json
"scripts": {
  "api:types": "openapi-typescript http://localhost:8080/api/v1/openapi.json -o src/api/generated/schema.d.ts",
  "api:check": "npm run api:types && git diff --exit-code src/api/generated/schema.d.ts"
}
```
```ts
// api/endpoints/scenarios.ts
import type { components } from '../generated/schema';
export type ScenarioDetail  = components['schemas']['ScenarioDetail'];
export type ScenarioRequest = components['schemas']['ScenarioRequest'];

export const scenariosApi = {
  create: (body: ScenarioRequest, idempotencyKey: string) =>
    apiClient.post<components['schemas']['ScenarioAccepted']>('/scenarios', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  get: (id: string) => apiClient.get<ScenarioDetail>(`/scenarios/${id}`),
  validation: (id: string) =>
    apiClient.get<components['schemas']['ValidationResponse']>(`/scenarios/${id}/validation`),
};
```
⭐ **`api:check` runs in CI.** If the backend changes a contract and the frontend wasn't regenerated, the build fails — contract drift caught at CI time, not demo time.

---

## 5. Disclosure enforcement (F1) — the frontend's honesty guarantee

### The type

```ts
// types/disclosed.ts
declare const brand: unique symbol;

/** A modelled value that cannot be read without acknowledging its disclosure. */
export interface Disclosed<T> {
  readonly [brand]: 'disclosed';
  readonly value: T;
  readonly disclosure: ModelDisclosure;
}

export function disclose<T>(value: T, disclosure: ModelDisclosure): Disclosed<T> {
  return { value, disclosure } as Disclosed<T>;
}

/** Explicit, searchable escape hatch. Grep-able in review. */
export function unsafeUnwrap<T>(d: Disclosed<T>, reason: string): T {
  if (import.meta.env.DEV) console.warn(`[disclosure] unwrapped: ${reason}`);
  return d.value;
}
```

### The component

```tsx
// components/DisclosedValue.tsx
export function DisclosedValue<T>({ datum, format, label }: {
  datum: Disclosed<T>;
  format: (v: T) => string;
  label: string;
}) {
  const { t } = useTranslation();
  const isHeuristic = datum.disclosure.model_class === 'heuristic_index';
  const validated   = datum.disclosure.validated_against;

  return (
    <span className={styles.root}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{format(datum.value)}</span>
      <DisclosureBadge
        variant={isHeuristic ? 'heuristic' : validated ? 'validated' : 'modelled'}
        skill={datum.disclosure.skill_metric}
        limitations={datum.disclosure.limitations}
        aria-label={t(isHeuristic ? 'disclosure.heuristicAria' : 'disclosure.modelledAria')}
      />
    </span>
  );
}
```

### How the boundary is enforced

```ts
// features/hazard/useHazard.ts — disclosure attached at the query boundary
export function useHazard(runId: string) {
  return useQuery({
    queryKey: queryKeys.hazard(runId),
    queryFn: () => hazardApi.get(runId),
    select: (res) => ({
      peakSurge:    disclose(res.surge.peak_surge_m,        toDisclosure(res)),
      floodedArea:  disclose(res.inundation.area_flooded_km2, toDisclosure(res)),
      maxWind:      disclose(res.max_wind_ms,               toDisclosure(res)),
      // ⭐ IMD's own forecast, surfaced alongside ours — never hidden
      imdForecastSurge: res.surge.imd_forecast_surge_m,
      raw: res,
    }),
  });
}
```

> ⭐ **The chain is now unbroken.** The backend cannot serialise a surge height without `model_class` and `limitations` (contract tests C1–C2). The frontend hook wraps it in `Disclosed<T>` at the query boundary. A developer who wants to render it must either use `<DisclosedValue>` — which renders the badge — or call `unsafeUnwrap(d, reason)`, which is a grep-able, reviewable, dev-warning-emitting act. **Dropping our caveats stops being an accident.**

An ESLint rule closes the last gap:
```js
'no-restricted-properties': ['error',
  { object: '*', property: 'value',
    message: 'Reading .value off a Disclosed<T> directly — use <DisclosedValue> or unsafeUnwrap(d, reason).' }]
```

---

## 6. Async scenario lifecycle

The backend returns `202 + run_id`, or `200` with `cache_hit: true`. Three states to handle, and the demo path must be instant.

```ts
// features/scenario/useScenarioRun.ts
export function useScenarioRun(runId: string | null) {
  const query = useQuery({
    queryKey: runId ? queryKeys.scenario(runId) : ['noop'],
    queryFn: () => scenariosApi.get(runId!),
    enabled: !!runId,
    // ⭐ poll only while in flight; immutable once complete
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'QUEUED' || s === 'RUNNING' ? 2_000 : false;
    },
    staleTime: (q) => (q.state.data?.status === 'COMPLETE' ? Infinity : 0),
  });

  useScenarioEvents(runId, query.data?.status);   // SSE enrichment, not the source of truth
  return query;
}

// SSE augments progress UI; polling remains the authority.
function useScenarioEvents(runId: string | null, status?: RunStatus) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!runId || (status !== 'QUEUED' && status !== 'RUNNING')) return;
    const es = new EventSource(`${import.meta.env.VITE_API_BASE}/scenarios/${runId}/events`);
    es.addEventListener('stage',    (e) => qc.setQueryData(stageKey(runId), JSON.parse(e.data)));
    es.addEventListener('complete', () => qc.invalidateQueries({ queryKey: queryKeys.scenario(runId) }));
    es.onerror = () => es.close();                 // ⭐ silent fallback to polling
    return () => es.close();
  }, [runId, status, qc]);
}
```

```ts
// creating a run — idempotent, cache-hit aware
export function useCreateScenario() {
  const qc = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  return useMutation({
    mutationFn: (req: ScenarioRequest) => scenariosApi.create(req, idempotencyKey.current),
    onSuccess: (accepted) => {
      // ⭐ cache_hit ⇒ results already exist; skip the progress UI entirely
      if (accepted.cache_hit) qc.invalidateQueries({ queryKey: queryKeys.scenario(accepted.run_id) });
      idempotencyKey.current = crypto.randomUUID();
    },
  });
}
```

⭐ **Demo prefetch.** Fani and Yaas are precomputed on the backend's hot tier. The app prefetches both on mount so the live demo is a cache hit in the browser *and* on the server:
```ts
// app/providers.tsx
useEffect(() => {
  for (const id of DEMO_RUN_IDS) {
    queryClient.prefetchQuery({ queryKey: queryKeys.scenario(id), queryFn: () => scenariosApi.get(id) });
    queryClient.prefetchQuery({ queryKey: queryKeys.validation(id), queryFn: () => scenariosApi.validation(id) });
  }
}, []);
```

---

## 7. Map architecture

**deck.gl over MapLibre basemap.** deck.gl handles 877 shelter points plus building polygons plus raster overlays on the GPU; Leaflet would struggle with the building layer.

```ts
// map/layers/useHazardLayers.ts
export function useHazardLayers(runId: string) {
  const { data: hazard } = useHazard(runId);
  const { data: assets } = useAssets(runId, { asset_type: 'SHELTER' });
  const tokens = useResolvedTokens();          // ⭐ CSS vars → RGBA tuples

  return useMemo(() => [
    new BitmapLayer({
      id: 'flood-extent',
      // ⭐ tile URL comes straight from the backend's signed GEE/GCS reference —
      //    pixel bytes never pass through our API
      image: hazard?.raw.inundation.flood_mask.tile_url,
      bounds: hazard?.raw.inundation.grid.bbox,
      opacity: 0.7,
    }),
    new GeoJsonLayer({
      id: 'shelters',
      data: assets,
      pointRadiusMinPixels: 5,
      getFillColor: (f) =>
        f.properties.compromised ? tokens.hazard.compromised : tokens.intent.success,
      pickable: true,
      updateTriggers: { getFillColor: [tokens] },
    }),
  ], [hazard, assets, tokens]);
}
```

### Bridging tokens into canvas rendering

deck.gl needs `[r,g,b,a]`, not CSS variables. **This is the one place style values are computed imperatively — and it still reads from tokens, never literals.**

```ts
// map/useResolvedTokens.ts
export function useResolvedTokens() {
  const theme = useTheme();      // re-resolves on theme change
  return useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    const rgba = (cssVar: string): [number,number,number,number] =>
      parseCssColorToRgba(root.getPropertyValue(cssVar).trim());
    return {
      hazard: {
        floodShallow: rgba('--prahari-color-hazard-floodShallow'),
        compromised:  rgba('--prahari-color-hazard-compromised'),
        observedTruth: rgba('--prahari-color-hazard-observedTruth'),
        predicted:     rgba('--prahari-color-hazard-predicted'),
        agreement:     rgba('--prahari-color-hazard-agreement'),
        falseAlarm:    rgba('--prahari-color-hazard-falseAlarm'),
        miss:          rgba('--prahari-color-hazard-miss'),
      },
      intent: { success: rgba('--prahari-color-intent-success'), /* … */ },
    };
  }, [theme]);
}
```

⭐ **The validation overlay is a token-driven confusion matrix** — `agreement` / `falseAlarm` / `miss` are semantic tokens, so predicted-vs-observed rendering is consistent between the map, the legend, and the metrics table. That's the differentiating screen; it deserves to be in the design system.

**Legend is generated from tokens**, never hand-authored, so a palette change can't desynchronise the map from its key.

---

## 8. Accessibility

Treated as a requirement, not a checklist item.

| Concern | Approach |
|---|---|
| **Colour is never the only channel** | Compromised shelters get an icon *and* a colour *and* a text label. Flood depth bands are patterned in addition to coloured. Required for a disaster tool used under stress. |
| **Map has a non-visual equivalent** | Every map layer has a paired data table route (`/scenario/:id/exposure`). ⭐ **The tables are the accessible primary, not a fallback** — all headline findings (compromised shelters, unassigned population) are reachable without the canvas. |
| **Contrast** | Token pairs are contrast-tested in CI (`@adobe/leonardo-contrast-colors` or an axe assertion); every text/surface pair must meet WCAG AA 4.5:1. |
| **Focus** | `vars.color.border.focus` on a visible 2px ring; no `outline: none` anywhere (stylelint-enforced). |
| **Live regions** | Scenario progress announces stage transitions via `aria-live="polite"`; completion via `role="status"`. |
| **Semantics** | Exposure tables are real `<table>` with `<caption>` and scoped headers, not div grids. |
| **Motion** | All transitions respect `prefers-reduced-motion`; `vars.duration.instant` is substituted wholesale. |
| **Keyboard** | Layer toggles, role/stage/language selectors, and shelter list are fully keyboard-navigable. Map pan/zoom has keyboard equivalents. |

```ts
// design/recipes/motion.css.ts
export const transition = styleVariants({
  standard: [{ transitionDuration: vars.duration.normal, transitionTimingFunction: vars.easing.standard,
               '@media': { '(prefers-reduced-motion: reduce)': { transitionDuration: vars.duration.instant } } }],
});
```

---

## 9. i18n

```
i18n/locales/{en,or}/{common,hazard,exposure,advisories,validation,errors}.json
```

- **Namespace per feature**, lazy-loaded with the route
- **No concatenated strings.** ICU MessageFormat for plurals and interpolation: `"{count, plural, one {# shelter} other {# shelters}} compromised"`
- **Numbers and dates via `Intl`**, locale-aware — and ⭐ **Indian digit grouping (lakh/crore) is handled by `Intl.NumberFormat('en-IN')`**, not a custom formatter
- **Error copy is keyed** — `ApiError.i18nKey` maps backend RFC 9457 `type` values to translations
- ⭐ **Advisory text is *not* translated client-side.** The backend generates Odia via Gemini and re-validates numeric grounding after translation. The frontend renders `advisory.language` as returned and shows the `generated_by` badge. **Translating advisories in the browser would bypass the grounding guarantee.**

---

## 10. Performance

| Concern | Approach |
|---|---|
| Bundle | Route-level code splitting; deck.gl + MapLibre in an async chunk (the map is ~40% of JS) |
| Long tables | `@tanstack/react-virtual` — village-level exposure can be thousands of rows |
| Immutable results | `staleTime: Infinity` on completed runs; no refetch on focus |
| Map re-renders | `useMemo` on layer arrays with explicit `updateTriggers` |
| Large GeoJSON | Backend serves FlatGeobuf/paginated GeoJSON; frontend requests `compromised_only=true` rather than filtering 877 records client-side |
| Prefetch | Demo runs prefetched on mount; hover-prefetch on scenario list rows |
| Budgets | CI fails above 250 KB initial JS (gzipped), excluding the async map chunk |

---

## 11. Testing

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | formatters, `disclose`/`unsafeUnwrap`, key factory, interceptor chain |
| Interceptors | Vitest + MSW | retry honours `Retry-After`; `hazard-model-error` is **never** retried; problem+json → typed `ApiError` |
| Hooks | RTL + MSW | polling stops on `COMPLETE`; `cache_hit` skips progress UI; SSE failure falls back silently |
| Component | RTL | ⭐ **a modelled value never renders without a disclosure badge** |
| a11y | `vitest-axe` + Playwright axe | zero violations on every route; contrast assertions on token pairs |
| Contract | CI | `npm run api:check` — generated types match live backend schema |
| Visual | Playwright screenshots | token theme swap (light/dark) doesn't break layout |
| E2E | Playwright | the demo journey: load → Fani → Puri at T-48h → compromised shelters → validation panel |

```tsx
// the test that encodes F1
it('never renders a surge height without a disclosure', () => {
  render(<HazardSummary runId="fani-demo" />);
  const value = screen.getByText(/\d+(\.\d+)?\s*m/);
  expect(value.closest('[data-disclosed]')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /heuristic/i })).toBeInTheDocument();
});
```

---

## 12. Architecture Decision Records

### ADR-F001 — vanilla-extract over Tailwind or CSS-in-JS
**Decision:** vanilla-extract with a global theme contract.
**Why:** it is the only option that makes "no hardcoded values" a **compile-time** guarantee — tokens are TypeScript, so a raw hex isn't a lint warning, it's a type error. Zero runtime cost, and `createGlobalThemeContract` gives real theming (light/dark, colour-blind-safe) without duplicating styles.
**Rejected:** Tailwind v4 `@theme` — faster to start and a legitimate alternative, but arbitrary values (`w-[13px]`) are always one keystroke away and only lintable, not type-checked. Emotion/styled-components — runtime cost and the `css` prop reintroduces inline style patterns.
**Cost accepted:** ~2 hours of Vite plugin setup, and the team must learn `.css.ts` files.

### ADR-F002 — Interceptors in the transport layer, not TanStack Query
**Decision:** a single `apiClient` owns request/response/error interceptors; `QueryClient` has `retry: false`.
**Why:** TanStack Query has no interceptor concept — it's a cache/async-state layer. Auth headers, request IDs, problem+json normalisation, and Retry-After handling are transport concerns. Putting retry in both layers multiplies attempts.

### ADR-F003 — Generated types, never hand-written
**Decision:** `openapi-typescript` from FastAPI's schema; `api:check` gates CI.
**Why:** the backend's Pydantic models are the contract. Hand-mirroring them guarantees drift. This turns a demo-day runtime error into a CI failure.

### ADR-F004 — `Disclosed<T>` branded type
**Decision:** modelled values are wrapped at the query boundary and unwrappable only via `<DisclosedValue>` or an explicit `unsafeUnwrap(d, reason)`.
**Why:** the backend guarantees caveats are *sent*; nothing otherwise guarantees they're *shown*. This extends the honesty chain to the pixel. The escape hatch is intentional — it's grep-able and reviewable rather than forbidden and worked around.

### ADR-F005 — deck.gl over Leaflet
**Decision:** deck.gl on a MapLibre basemap.
**Why:** GPU rendering for 877 shelters + building polygons + raster overlays. Leaflet degrades on the building layer.
**Cost:** larger bundle — mitigated by an async chunk.

### ADR-F006 — Polling as source of truth, SSE as enrichment
**Decision:** `refetchInterval` drives state; SSE only enriches stage-level progress.
**Why:** SSE through Cloud Run with proxies and venue wifi is a demo-day liability. Polling always works. SSE failing closes the connection silently and nothing breaks.

### ADR-F007 — Tables are the accessible primary, not a fallback
**Decision:** every map insight has an equivalent data-table route.
**Why:** a disaster decision-support tool used under stress must work for screen-reader users and on a projector at the back of a room. Every headline finding — compromised shelters, unassigned population, validation metrics — is reachable without the canvas.

### ADR-F008 — Advisories are never translated client-side
**Decision:** render `advisory.language` exactly as the backend returns it.
**Why:** the backend re-validates numeric grounding *after* Odia translation. A client-side translation would bypass that check and could silently corrupt a number in an official instruction — precisely the failure mode the whole grounding system exists to prevent.
