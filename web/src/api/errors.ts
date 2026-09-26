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

export const PROBLEM_I18N: Record<string, string> = {
  "https://prahari.dev/problems/storm-not-found": "errors.stormNotFound",
  "https://prahari.dev/problems/run-not-found": "errors.runNotFound",
  "https://prahari.dev/problems/aoi-too-large": "errors.aoiTooLarge",
  "https://prahari.dev/problems/truth-unavailable": "errors.truthUnavailable",
  "https://prahari.dev/problems/hazard-model-error": "errors.hazardModelError",
  "https://prahari.dev/problems/quota-exceeded": "errors.quotaExceeded",
  "https://prahari.dev/problems/validation-error": "errors.validation",
  "https://prahari.dev/problems/ingestion-error": "errors.ingestion",
  "https://prahari.dev/problems/invalid-track-source": "errors.invalidTrackSource",
  "https://prahari.dev/problems/track-kind-unsupported": "errors.trackKindUnsupported",
  "https://prahari.dev/problems/no-landfall": "errors.noLandfall",
  "https://prahari.dev/problems/outside-coverage": "errors.outsideCoverage",
  "https://prahari.dev/problems/track-too-short": "errors.trackTooShort",
  "https://prahari.dev/problems/unauthorized": "errors.unauthorized",
};

/**
 * English copy per i18n key until i18next is initialised. Plain words for an
 * official; the server's `detail` adds the storm-specific reason.
 */
const PLAIN_EN: Record<string, string> = {
  "errors.stormNotFound": "That storm is not in the IBTrACS best-track file.",
  "errors.runNotFound": "No computed run with that name.",
  "errors.truthUnavailable": "No satellite truth exists for this storm, so its flood cannot be scored.",
  "errors.hazardModelError": "The hazard model failed on this storm. Nothing was shown rather than a wrong number.",
  "errors.quotaExceeded": "Another scenario is computing. Try again in a minute.",
  "errors.ingestion": "An upstream data source did not answer. Try again shortly.",
  "errors.trackKindUnsupported": "Live GDACS feeds and IMD bulletins are not ingested yet.",
  "errors.noLandfall": "This storm never made a coastal landfall, so there is no surge to model.",
  "errors.outsideCoverage": "This storm made landfall outside the coasts PRAHARI covers.",
  "errors.trackTooShort": "The best track is too short or too sparse to model.",
  "errors.unauthorized": "Modelling a new storm is operator-only on this deployment.",
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

  /** One plain sentence for the screen, in English until i18n is initialised. */
  get plain(): string {
    return PLAIN_EN[this.i18nKey] ?? this.title;
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
