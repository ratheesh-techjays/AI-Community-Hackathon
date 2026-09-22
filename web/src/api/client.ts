/**
 * THE SINGLE TRANSPORT LAYER.
 *
 * Every network call in the app goes through here. `fetch` is banned globally
 * by ESLint outside this file.
 *
 * Note: TanStack Query has no interceptor concept -- it is a cache and async
 * state layer. Auth headers, request IDs, problem+json normalisation, and
 * Retry-After handling are transport concerns and live here. QueryClient sets
 * `retry: false` so retry logic exists in exactly one place; two stacked retry
 * systems is how one click becomes eight requests.
 */
import { ApiError, toApiError } from "./errors";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";
const MAX_ATTEMPTS = 3;

export interface RequestContext {
  path: string;
  url: string;
  init: RequestInit;
  meta: { requestId: string; startedAt: number; attempt: number };
}

export type RequestInterceptor = (ctx: RequestContext) => Promise<RequestContext> | RequestContext;

export type ResponseInterceptor = (
  res: Response,
  ctx: RequestContext,
) => Promise<Response> | Response;

/** Return a value to recover from the error; throw to propagate it. */
export type ErrorInterceptor = (err: unknown, ctx: RequestContext) => Promise<unknown>;

export interface Interceptor {
  request?: RequestInterceptor;
  response?: ResponseInterceptor;
  error?: ErrorInterceptor;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class ApiClient {
  private readonly requestChain: RequestInterceptor[] = [];
  private readonly responseChain: ResponseInterceptor[] = [];
  private readonly errorChain: ErrorInterceptor[] = [];

  use(interceptor: Interceptor): this {
    if (interceptor.request) this.requestChain.push(interceptor.request);
    if (interceptor.response) this.responseChain.push(interceptor.response);
    if (interceptor.error) this.errorChain.push(interceptor.error);
    return this;
  }

  async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    // `HeadersInit` can be a Headers instance, an array of tuples, or a record.
    // Spreading it blindly turns the first two into index keys.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value;
      });
    }

    let ctx: RequestContext = {
      path,
      url: `${API_BASE}${path}`,
      init: { ...init, headers },
      meta: { requestId: crypto.randomUUID(), startedAt: performance.now(), attempt },
    };

    for (const intercept of this.requestChain) {
      ctx = await intercept(ctx);
    }

    try {
      let res = await fetch(ctx.url, ctx.init);
      for (const intercept of this.responseChain) {
        res = await intercept(res, ctx);
      }
      if (!res.ok) throw await toApiError(res, ctx.meta.requestId);
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      for (const intercept of this.errorChain) {
        const recovered = await intercept(err, ctx);
        if (recovered !== undefined) return recovered as T;
      }
      throw err;
    }
  }

  get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const withBody: RequestInit =
      body === undefined
        ? { ...init, method: "POST" }
        : { ...init, method: "POST", body: JSON.stringify(body) };
    return this.request<T>(path, withBody);
  }

  delete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}

export const apiClient: ApiClient = new ApiClient();

// --- request id: correlates with the backend RequestIDMiddleware ------------
apiClient.use({
  request: (ctx) => {
    (ctx.init.headers as Record<string, string>)["X-Request-Id"] = ctx.meta.requestId;
    return ctx;
  },
});

// --- auth: demo reads are open; write endpoints take a key ------------------
apiClient.use({
  request: (ctx) => {
    const key = import.meta.env.VITE_PRAHARI_KEY;
    if (key) (ctx.init.headers as Record<string, string>)["X-Prahari-Key"] = key;
    return ctx;
  },
});

// --- retry: honours Retry-After, NEVER retries a hazard model failure -------
// The backend deliberately returns 500 hazard-model-error rather than
// degrading, because we serve a worse sentence but never a wrong number.
// Retrying that would mask a real failure and cannot succeed.
apiClient.use({
  error: async (err, ctx): Promise<unknown> => {
    if (!(err instanceof ApiError)) throw err;
    if (!err.isRetriable || ctx.meta.attempt >= MAX_ATTEMPTS - 1) throw err;

    const backoffMs =
      err.retryAfter !== undefined
        ? err.retryAfter * 1000
        : 2 ** ctx.meta.attempt * 400 + Math.random() * 200;

    await sleep(backoffMs);
    return apiClient.request(ctx.path, ctx.init, ctx.meta.attempt + 1);
  },
});

// --- telemetry --------------------------------------------------------------
apiClient.use({
  response: (res, ctx) => {
    if (import.meta.env.DEV) {
      const ms = Math.round(performance.now() - ctx.meta.startedAt);
      console.debug(`[api] ${ctx.init.method ?? "GET"} ${ctx.path} -> ${res.status} (${ms}ms)`);
    }
    return res;
  },
});
