/**
 * RFC 9457 problem+json -> typed, i18n-ready errors.
 *
 * The backend returns `application/problem+json` with a stable `type` URI.
 * We map those URIs to i18n keys so error copy is translatable rather than
 * pulled verbatim from an API response.
 */

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorInit {
  status: number;
  type: string;
  title: string;
  detail?: string | undefined;
  fieldErrors?: FieldError[] | undefined;
  requestId: string;
  retryAfter?: number | undefined;
}

const PROBLEM_I18N: Record<string, string> = {
  "https://prahari.dev/problems/storm-not-found": "errors.stormNotFound",
  "https://prahari.dev/problems/run-not-found": "errors.runNotFound",
  "https://prahari.dev/problems/aoi-too-large": "errors.aoiTooLarge",
  "https://prahari.dev/problems/truth-unavailable": "errors.truthUnavailable",
  "https://prahari.dev/problems/hazard-model-error": "errors.hazardModelError",
  "https://prahari.dev/problems/quota-exceeded": "errors.quotaExceeded",
  "https://prahari.dev/problems/validation-error": "errors.validation",
  "https://prahari.dev/problems/ingestion-error": "errors.ingestion",
};

export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: FieldError[] | undefined;
  readonly requestId: string;
  readonly retryAfter: number | undefined;
  readonly i18nKey: string;

  constructor(init: ApiErrorInit) {
    super(init.detail ?? init.title);
    this.name = "ApiError";
    this.status = init.status;
    this.type = init.type;
    this.title = init.title;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
    this.i18nKey = PROBLEM_I18N[init.type] ?? "errors.unexpected";
  }

  /**
   * The science failed, not the network. Retrying would mask a real failure
   * and cannot succeed. See the deliberate asymmetry in 06-api-contracts.md.
   */
  get isHazardModelError(): boolean {
    return this.type.endsWith("/hazard-model-error");
  }

  /** No ground truth exists for this storm; a score must never be fabricated. */
  get isTruthUnavailable(): boolean {
    return this.type.endsWith("/truth-unavailable");
  }

  get isRetriable(): boolean {
    if (this.isHazardModelError) return false;
    return this.status === 429 || this.status === 503 || this.status >= 500;
  }
}

export async function toApiError(res: Response, requestId: string): Promise<ApiError> {
  const isProblem = res.headers.get("content-type")?.includes("application/problem+json");
  const body = isProblem
    ? ((await res.json().catch(() => null)) as Record<string, unknown> | null)
    : null;

  const retryAfterHeader = res.headers.get("Retry-After");

  return new ApiError({
    status: res.status,
    type: (body?.["type"] as string) ?? "about:blank",
    title: (body?.["title"] as string) ?? res.statusText,
    detail: body?.["detail"] as string | undefined,
    fieldErrors: body?.["errors"] as FieldError[] | undefined,
    requestId,
    retryAfter: retryAfterHeader ? Number(retryAfterHeader) : undefined,
  });
}
