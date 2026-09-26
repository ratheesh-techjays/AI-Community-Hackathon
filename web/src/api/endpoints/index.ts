/**
 * Thin typed wrappers over apiClient.
 *
 * Every type here comes from the backend's OpenAPI schema:
 *
 *     npm run api:types      # regenerates src/api/generated/schema.d.ts
 *     npm run api:check      # CI gate: fails if the committed schema drifted
 *
 * so backend contract drift is a type error, not a demo-day runtime error.
 */
import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { ShelterParams } from "../queryKeys";

type Schemas = components["schemas"];

export type HealthResponse = Schemas["HealthResponse"];
export type SourceDescriptor = Schemas["SourceDescriptor"];
export type LimitationsResponse = Schemas["LimitationsResponse"];
export type StormSummary = Schemas["StormSummary"];
export type CycloneTrack = Schemas["CycloneTrack"];
export type ShelterRecord = Schemas["ShelterRecord"];

export type RunStatus = Schemas["ScenarioDetail"]["status"];
export type ScenarioRequest = Schemas["ScenarioRequest"];
export type ScenarioAccepted = Schemas["ScenarioAccepted"];
export type ScenarioDetail = Schemas["ScenarioDetail"];
export type RunSummary = Schemas["RunSummary"];
export type Coverage = Schemas["Coverage"];
export type ModelDisclosure = Schemas["ModelDisclosure"];
export type HazardResponse = Schemas["HazardResponse"];
export type LayerRef = Schemas["LayerRef"];
export type ExposureResponse = Schemas["ExposureResponse"];
export type BlockExposure = Schemas["BlockExposure"];
export type AssetsResponse = Schemas["AssetsResponse"];
export type ShelterStatus = Schemas["ShelterStatus"];
export type DecisionsResponse = Schemas["DecisionsResponse"];
export type ActionItem = Schemas["ActionItem"];
export type UnassignedCluster = Schemas["UnassignedCluster"];
export type ParametricResponse = Schemas["ParametricResponse"];
export type ValidationResponse = Schemas["ValidationResponse"];
export type AdvisoriesResponse = Schemas["AdvisoriesResponse"];
export type Advisory = Schemas["Advisory"];
export type QueryRequest = Schemas["QueryRequest"];
export type QueryResponse = Schemas["QueryResponse"];

export const metaApi = {
  health: () => apiClient.get<HealthResponse>("/healthz"),
  sources: () => apiClient.get<{ sources: SourceDescriptor[] }>("/meta/sources"),
  limitations: () => apiClient.get<LimitationsResponse>("/meta/limitations"),
};

export const stormsApi = {
  list: () => apiClient.get<{ storms: StormSummary[] }>("/storms"),
  track: (name: string, season?: number) =>
    apiClient.get<CycloneTrack>(
      `/storms/${encodeURIComponent(name)}/track${season ? `?season=${season}` : ""}`,
    ),
};

export const sheltersApi = {
  list: (params: ShelterParams) => {
    const qs = new URLSearchParams();
    if (params.district) qs.set("district", params.district);
    if (params.shelterType) qs.set("shelter_type", params.shelterType);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<{ count: number; shelters: ShelterRecord[] }>(`/shelters${suffix}`);
  },
};

const run = (runId: string, part: string): string =>
  `/scenarios/${encodeURIComponent(runId)}/${part}`;

export const scenariosApi = {
  create: (body: ScenarioRequest, idempotencyKey: string) =>
    apiClient.post<ScenarioAccepted>("/scenarios", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  get: (runId: string) => apiClient.get<ScenarioDetail>(`/scenarios/${encodeURIComponent(runId)}`),
  hazard: (runId: string) => apiClient.get<HazardResponse>(run(runId, "hazard")),
  exposure: (runId: string) => apiClient.get<ExposureResponse>(run(runId, "exposure")),
  assets: (runId: string) => apiClient.get<AssetsResponse>(run(runId, "assets")),
  decisions: (runId: string) => apiClient.get<DecisionsResponse>(run(runId, "decisions")),
  parametric: (runId: string) => apiClient.get<ParametricResponse>(run(runId, "parametric")),
  validation: (runId: string) => apiClient.get<ValidationResponse>(run(runId, "validation")),
  advisories: (runId: string) => apiClient.get<AdvisoriesResponse>(run(runId, "advisories")),
};

export const queryApi = {
  /** Gemini function calling over a stored run; every number is re-validated. */
  ask: (body: QueryRequest) => apiClient.post<QueryResponse>("/query", body),
};
