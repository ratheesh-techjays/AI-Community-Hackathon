/**
 * Thin typed wrappers over apiClient.
 *
 * TODO(frontend): once the backend is running, replace these hand-written
 * interfaces with generated types:
 *
 *     npm run api:types      # writes src/api/generated/schema.d.ts
 *     import type { components } from "../generated/schema";
 *     type ScenarioDetail = components["schemas"]["ScenarioDetail"];
 *
 * `npm run api:check` gates CI so backend contract drift becomes a CI failure
 * rather than a demo-day runtime error.
 */
import { apiClient } from "../client";
import type { ShelterParams } from "../queryKeys";

// --- meta -------------------------------------------------------------------

export interface HealthResponse {
  status: "ok" | "degraded";
  gee_authenticated: boolean;
  gemini_reachable: boolean;
  gcs_writable: boolean;
  db_reachable: boolean;
  ai_enabled: boolean;
  code_version: string;
}

export interface SourceDescriptor {
  source_id: string;
  authority: string;
  url?: string | null;
  licence: string;
  role: string;
  is_synthetic: boolean;
  confidence: string;
}

export interface LimitationsResponse {
  surge: string[];
  parametric: string[];
  general: string[];
}

export const metaApi = {
  health: () => apiClient.get<HealthResponse>("/healthz"),
  sources: () => apiClient.get<{ sources: SourceDescriptor[] }>("/meta/sources"),
  limitations: () => apiClient.get<LimitationsResponse>("/meta/limitations"),
};

// --- storms -----------------------------------------------------------------

export interface StormSummary {
  name: string;
  season: number;
  has_sar_truth: boolean;
  has_ems_activation: boolean;
  note: string;
}

export interface TrackPoint {
  iso_time: string;
  lat: number;
  lon: number;
  max_wind_kt: number | null;
  central_pressure_mb: number | null;
  rmw_nmi: number | null;
  rmw_imputed: boolean;
}

export interface CycloneTrack {
  sid: string;
  name: string;
  season: number;
  points: TrackPoint[];
  landfall: { iso_time: string; lat: number; lon: number } | null;
  provenance: { authority: string; confidence: string; caveats: string[] };
}

export const stormsApi = {
  list: () => apiClient.get<{ storms: StormSummary[] }>("/storms"),
  track: (name: string, season?: number) =>
    apiClient.get<CycloneTrack>(
      `/storms/${encodeURIComponent(name)}/track${season ? `?season=${season}` : ""}`,
    ),
};

// --- shelters ---------------------------------------------------------------

export interface Shelter {
  name: string;
  lat: number;
  lon: number;
  district: string;
  block: string | null;
  village: string | null;
  shelter_type: string;
}

export const sheltersApi = {
  list: (params: ShelterParams) => {
    const qs = new URLSearchParams();
    if (params.district) qs.set("district", params.district);
    if (params.shelterType) qs.set("shelter_type", params.shelterType);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiClient.get<{ count: number; shelters: Shelter[] }>(`/shelters${suffix}`);
  },
};

// --- scenarios --------------------------------------------------------------

export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";

export interface ScenarioRequest {
  track: { kind: "ibtracs" | "gdacs" | "bulletin" | "manual"; storm_name?: string; season?: number };
  aoi_preset: string;
  hazard?: { surge_level_m?: number; funnel_amplification?: number; dem_offset_m?: number };
  generate_advisories?: boolean;
  languages?: Array<"en" | "or">;
  run_validation?: boolean;
  label?: string;
}

export interface ScenarioAccepted {
  run_id: string;
  status: RunStatus;
  params_hash: string;
  cache_hit: boolean;
  poll_url: string;
  events_url: string;
  estimated_seconds: number | null;
}

export interface ScenarioDetail {
  run_id: string;
  status: RunStatus;
  request: ScenarioRequest;
  params_hash: string;
  code_version: string;
  config_version: string;
  stages_complete: string[];
  warnings: string[];
  summary: ScenarioSummary | null;
  created_at: string;
}

export interface ScenarioSummary {
  storm_name: string;
  peak_surge_m: number;
  area_flooded_km2: number;
  population_at_risk: number;
  buildings_at_risk: number;
  shelters_total: number;
  shelters_compromised: number;
  unassigned_population: number;
  compressed_timeline: boolean;
  disclosure: {
    model_class: "heuristic_index" | "parametric_physical" | "optimisation";
    limitations: string[];
    validated_against?: string | null;
    skill_metric?: Record<string, number> | null;
  };
}

export const scenariosApi = {
  create: (body: ScenarioRequest, idempotencyKey: string) =>
    apiClient.post<ScenarioAccepted>("/scenarios", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  get: (runId: string) => apiClient.get<ScenarioDetail>(`/scenarios/${runId}`),
};

// Endpoints the backend has not shipped yet -- see docs/design/06-api-contracts.md:
//   /scenarios/{id}/hazard, /exposure, /assets, /decisions, /advisories,
//   /parametric, /validation
// Until they exist, screens read from src/features/fixtures/, whose shapes
// match those responses exactly.
