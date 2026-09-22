/**
 * THE SINGLE QUERY KEY FACTORY.
 *
 * Never inline a query key at a call site. Hierarchical keys make targeted
 * invalidation possible: invalidating `scenario(id)` drops every child query
 * for that run.
 */

export interface ExposureParams {
  adminLevel?: "village" | "block" | "district";
  district?: string;
}

export interface AssetParams {
  assetType?: string;
  compromisedOnly?: boolean;
}

export interface AdvisoryParams {
  role?: string;
  stage?: string;
  lang?: "en" | "or";
}

export interface ShelterParams {
  district?: string;
  shelterType?: string;
}

export const queryKeys = {
  all: ["prahari"] as const,

  storms: () => [...queryKeys.all, "storms"] as const,
  storm: (name: string) => [...queryKeys.storms(), name] as const,
  track: (name: string, season?: number) => [...queryKeys.storm(name), "track", season] as const,

  scenarios: () => [...queryKeys.all, "scenarios"] as const,
  scenario: (id: string) => [...queryKeys.scenarios(), id] as const,
  hazard: (id: string) => [...queryKeys.scenario(id), "hazard"] as const,
  exposure: (id: string, params: ExposureParams) =>
    [...queryKeys.scenario(id), "exposure", params] as const,
  assets: (id: string, params: AssetParams) =>
    [...queryKeys.scenario(id), "assets", params] as const,
  decisions: (id: string) => [...queryKeys.scenario(id), "decisions"] as const,
  advisories: (id: string, params: AdvisoryParams) =>
    [...queryKeys.scenario(id), "advisories", params] as const,
  parametric: (id: string) => [...queryKeys.scenario(id), "parametric"] as const,
  validation: (id: string) => [...queryKeys.scenario(id), "validation"] as const,
  stage: (id: string) => [...queryKeys.scenario(id), "stage"] as const,

  shelters: (params: ShelterParams) => [...queryKeys.all, "shelters", params] as const,

  meta: {
    sources: () => [...queryKeys.all, "meta", "sources"] as const,
    limitations: () => [...queryKeys.all, "meta", "limitations"] as const,
    health: () => [...queryKeys.all, "meta", "health"] as const,
  },

  evals: (suite?: string) => [...queryKeys.all, "evals", suite ?? "all"] as const,
} as const;
