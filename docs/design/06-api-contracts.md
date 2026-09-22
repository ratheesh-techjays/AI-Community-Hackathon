# PRAHARI — Backend API Contracts (FastAPI)

**Version** 1.0 · **Date** 2026-09-22 · **Python** 3.11 · **Framework** FastAPI + Pydantic v2

---

## 1. Conventions

| | |
|---|---|
| Base path | `/api/v1` |
| Auth | none for demo reads; API key header `X-Prahari-Key` on write/compute endpoints |
| Errors | RFC 9457 `application/problem+json` |
| Async compute | `202 Accepted` + `run_id`; poll `GET` or subscribe SSE |
| Geo payloads | GeoJSON (RFC 7946), EPSG:4326, lon/lat order |
| Large rasters | **never inlined** — signed GCS URLs (15 min TTL) |
| Pagination | cursor-based (`?cursor=&limit=`) |
| Idempotency | `Idempotency-Key` header on `POST /scenarios` |

### Two response envelopes that appear everywhere

```python
class Provenance(BaseModel):
    source_id: str
    authority: str
    url: HttpUrl | None
    retrieved_at: datetime
    is_synthetic: bool = False
    confidence: Literal["HIGH", "MEDIUM", "LOW", "DERIVED"]
    caveats: list[str] = []

class ModelDisclosure(BaseModel):
    """⭐ Attached to every response carrying modelled output.
    Cannot be omitted — enforced by the response models below."""
    model_class: Literal["heuristic_index", "parametric_physical", "optimisation"]
    limitations: list[str]
    validated_against: str | None      # "sentinel1_sar_fani_2019" | None
    skill_metric: dict[str, float] | None   # {"csi": 0.38, "pod": 0.61}
```

> **The design rule made mechanical:** any endpoint returning a surge height, flood extent, or exposure count returns `ModelDisclosure` as a required field. A client physically cannot render our numbers without our caveats.

---

## 2. Endpoint map

```
GET    /api/v1/healthz
GET    /api/v1/meta/sources
GET    /api/v1/meta/limitations

GET    /api/v1/storms
GET    /api/v1/storms/{sid}
GET    /api/v1/storms/{sid}/track
POST   /api/v1/storms/from-bulletin          # ⭐ Gemini J1

POST   /api/v1/scenarios                     # ⭐ main compute entrypoint
GET    /api/v1/scenarios
GET    /api/v1/scenarios/{run_id}
GET    /api/v1/scenarios/{run_id}/events      # SSE progress
DELETE /api/v1/scenarios/{run_id}

GET    /api/v1/scenarios/{run_id}/hazard
GET    /api/v1/scenarios/{run_id}/exposure
GET    /api/v1/scenarios/{run_id}/assets
GET    /api/v1/scenarios/{run_id}/decisions
GET    /api/v1/scenarios/{run_id}/advisories
GET    /api/v1/scenarios/{run_id}/parametric
GET    /api/v1/scenarios/{run_id}/validation  # ⭐ the eval panel
GET    /api/v1/scenarios/{run_id}/layers/{layer}
GET    /api/v1/scenarios/{run_id}/tiles/{layer}

GET    /api/v1/shelters
GET    /api/v1/shelters/{asset_id}

POST   /api/v1/query                          # ⭐ Gemini J3

GET    /api/v1/evals
GET    /api/v1/evals/{suite}
GET    /api/v1/evals/sensitivity
```

---

## 3. Core: scenario compute

### `POST /api/v1/scenarios`

```python
class TrackSource(BaseModel):
    kind: Literal["ibtracs", "gdacs", "bulletin", "manual"]
    sid: str | None = None                # ibtracs: "2019119N09086"
    gdacs_event_id: str | None = None
    bulletin_extraction_id: UUID | None = None
    manual_points: list[TrackPoint] | None = None

class HazardParams(BaseModel):
    surge_level_m: float | None = None    # None ⇒ derive from heuristic
    funnel_amplification: float | None = None
    holland_b_override: float | None = Field(None, ge=1.0, le=2.5)
    dem_offset_m: float = 0.0             # sensitivity sweeps

class ScenarioRequest(BaseModel):
    track: TrackSource
    aoi: AOISpec                          # named preset | bbox | admin codes
    hazard: HazardParams = HazardParams()
    exposure_layers: list[AssetType] = ALL_DEFAULT
    generate_advisories: bool = True
    languages: list[Literal["en", "or"]] = ["en"]
    roles: list[Role] = ALL_ROLES
    run_validation: bool = False          # only where SAR truth exists
    label: str | None = None              # excluded from params_hash

class ScenarioAccepted(BaseModel):
    run_id: UUID
    status: RunStatus
    params_hash: str
    cache_hit: bool                       # ⭐ true ⇒ already complete
    poll_url: str
    events_url: str
    estimated_seconds: int | None
```

**Responses** — `202` queued · `200` cache hit (returns the existing complete run) · `422` validation · `429` quota + `Retry-After` · `413` AOI too large

```python
@router.post("/scenarios", status_code=202, response_model=ScenarioAccepted)
async def create_scenario(
    req: ScenarioRequest,
    idempotency_key: Annotated[str | None, Header()] = None,
    svc: ScenarioService = Depends(get_scenario_service),
) -> ScenarioAccepted:
    phash = svc.params_hash(req)
    if existing := await svc.find_complete(phash):          # ⭐ cache contract
        return ScenarioAccepted(run_id=existing.run_id, status=RunStatus.COMPLETE,
                                params_hash=phash, cache_hit=True, ...)
    svc.assert_aoi_within_limits(req.aoi)                    # 413 guard
    run = await svc.enqueue(req, phash, idempotency_key)
    return ScenarioAccepted(..., cache_hit=False, estimated_seconds=svc.estimate(req))
```

### `GET /api/v1/scenarios/{run_id}`

```python
class ScenarioDetail(BaseModel):
    run_id: UUID
    status: RunStatus
    request: ScenarioRequest
    params_hash: str
    provenance: dict[str, Provenance]     # per source
    code_version: str
    config_version: str
    model_versions: dict[str, str]
    stage_timings_ms: dict[str, int]
    stages_complete: list[str]            # resumability
    warnings: list[RunWarning]
    artefacts: dict[str, ArtefactRef]
    summary: ScenarioSummary | None        # headline numbers when COMPLETE
```

```python
class ScenarioSummary(BaseModel):
    storm_name: str
    landfall_at: datetime | None
    hours_to_landfall: float | None
    compressed_timeline: bool             # ⭐ IMD stages skipped
    peak_surge_m: float
    area_flooded_km2: float
    population_at_risk: int
    buildings_at_risk: int
    shelters_total: int
    shelters_compromised: int             # ⭐ flagship metric
    unassigned_population: int            # ⭐ people with no reachable shelter
    disclosure: ModelDisclosure           # ⭐ required
```

### `GET /api/v1/scenarios/{run_id}/events` (SSE)

```
event: stage
data: {"stage":"hazard.wind_field","status":"complete","elapsed_ms":2841}

event: stage
data: {"stage":"exposure.buildings","status":"running"}

event: warning
data: {"code":"RMW_IMPUTED","detail":"6 of 71 timesteps imputed"}

event: complete
data: {"run_id":"...","summary":{...}}
```
Used for demo progress UI. Falls back to polling; **the demo's hot tier never needs it** (precomputed runs return cache hits).

---

## 4. Result endpoints

### `GET /scenarios/{run_id}/hazard`
```python
class HazardResponse(BaseModel):
    wind_field: RasterRef                 # signed COG URL
    holland_b: float
    max_wind_ms: float
    surge: SurgeEstimateOut
    inundation: InundationOut
    disclosure: ModelDisclosure

class SurgeEstimateOut(BaseModel):
    peak_surge_m: float
    funnel_amplification: float
    coefficient: float
    model_class: Literal["heuristic_index"]     # ⭐ literal, never absent
    imd_forecast_surge_m: str | None            # ⭐ "3.0–4.5" shown alongside ours
    limitations: list[str]
    calibration: CalibrationInfo | None

class InundationOut(BaseModel):
    flood_mask: RasterRef
    surge_level_m: float
    area_flooded_km2: float
    connectivity_enforced: Literal[True]        # ⭐ type-level guarantee
    dem_asset: str
    dem_vertical_error_m: float
```

### `GET /scenarios/{run_id}/exposure`
`?admin_level=village|block|district&district=PURI`
```python
class ExposureResponse(BaseModel):
    admin_level: AdminLevel
    rows: list[ExposureSummary]
    totals: ExposureSummary
    disclosure: ModelDisclosure
    provenance: dict[str, Provenance]
```

### `GET /scenarios/{run_id}/assets`
`?asset_type=SHELTER&compromised_only=true`
```python
class AssetsResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[AssetFeature]          # GeoJSON, props include hazard_bands
    count: int
    next_cursor: str | None
```
⭐ `?asset_type=SHELTER&compromised_only=true` is the flagship query: **named shelters that are themselves inside the surge zone.**

### `GET /scenarios/{run_id}/decisions`
```python
class DecisionsResponse(BaseModel):
    assignments: list[ShelterAssignment]
    unassigned: list[UnassignedCluster]   # ⭐ each with a machine-readable reason
    optimiser: OptimiserReport
    disclosure: ModelDisclosure

class ShelterAssignment(BaseModel):
    population_cluster_id: str
    admin: AdminUnit
    people: int
    shelter_asset_id: str
    shelter_name: str
    travel_time_min: float
    distance_km: float
    capacity_utilisation: float

class UnassignedCluster(BaseModel):
    population_cluster_id: str
    admin: AdminUnit
    people: int
    reason: Literal["no_reachable_shelter", "capacity_exhausted",
                    "all_shelters_compromised", "no_road_connection"]
    nearest_infeasible_shelter: str | None
    why_infeasible: str

class OptimiserReport(BaseModel):
    solver: Literal["ortools_min_cost_flow"]
    status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE"]
    arcs_considered: int
    arcs_filtered: int                    # pre-solve feasibility filter
    total_cost: float
    greedy_baseline_cost: float           # ⭐ proves optimisation earned its place
    solve_ms: int
```

### `GET /scenarios/{run_id}/advisories`
`?role=COLLECTOR&stage=CYCLONE_ALERT&lang=en`
```python
class AdvisoriesResponse(BaseModel):
    advisories: list[Advisory]

class Advisory(BaseModel):
    role: Role
    stage: IMDStage
    language: Literal["en", "or"]
    headline: str
    situation: str
    actions: list[ActionItem]
    caveats: list[str]                    # ⭐ injected, never generated
    generated_by: Literal["GEMINI", "GEMINI_REPAIRED", "TEMPLATE_FALLBACK"]
    grounding: GroundingReport            # ⭐ shipped with the advisory
    model_id: str | None
    prompt_version: str | None

class ActionItem(BaseModel):
    sequence: int
    action: str
    responsible_office: str
    deadline: datetime
    hours_before_landfall: float
    depends_on: list[int] = []
```

### `GET /scenarios/{run_id}/parametric`
```python
class ParametricResponse(BaseModel):
    zones: list[ZoneTrigger]
    total_payout_inr: float
    disclosure: ModelDisclosure           # includes illustrative_not_actuarial

class ZoneTrigger(BaseModel):
    zone_id: str
    zone_name: str
    trigger_a_source_in_shape: TriggerDetail
    trigger_b_population_index: TriggerDetail
    payout_inr: float                     # max(A, B) — PCRIC pattern
    triggered: bool
    reference_agency: Literal["IMD_RSMC_NEW_DELHI"]
    basis: Literal["illustrative_not_actuarial"]   # ⭐ literal
```

### ⭐ `GET /scenarios/{run_id}/validation`
The eval panel — **the endpoint that carries the credibility argument.**
```python
class ValidationResponse(BaseModel):
    available: bool                       # false unless SAR truth exists for this storm
    storm: str
    aoi: str
    skill: HazardSkillOut | None
    sensitivity: list[SensitivityPoint]
    ems_crosscheck: EMSCrossCheck | None
    observed_mask: RasterRef | None
    predicted_mask: RasterRef | None

class HazardSkillOut(BaseModel):
    csi: float                            # = Threat Score = IoU (report one)
    pod: float
    far: float
    bias: float
    hits: int
    misses: int
    false_alarms: int
    expected_range: tuple[float, float]   # (0.30, 0.50) — honest band
    truth_source: str                     # "sentinel1_vh_ratio_1.25"
    orbit_pass: Literal["ASCENDING", "DESCENDING"]   # ⭐ consistency proof
    failure_analysis: list[str]           # ⭐ required, never empty
```

---

## 5. Bulletin extraction — `POST /storms/from-bulletin`

```python
class BulletinRequest(BaseModel):
    pdf_url: HttpUrl | None = None
    pdf_base64: str | None = None
    cross_validate_sid: str | None = None   # compare against IBTrACS

class BulletinResponse(BaseModel):
    extraction_id: UUID
    extraction: BulletinExtraction          # per-field value + confidence + source_text
    cross_validation: CrossValidationReport | None
    usable_for_scenario: bool               # false if critical fields low-confidence
    review_required_fields: list[str]
```
`multipart/form-data` upload also supported. Extraction is persisted so a scenario can reference it by `extraction_id` — keeping `POST /scenarios` deterministic and cacheable.

---

## 6. Analyst query — `POST /query`

```python
class QueryRequest(BaseModel):
    question: str = Field(max_length=500)
    run_id: UUID | None = None
    language: Literal["en", "or"] = "en"

class QueryResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]       # ⭐ full transparency
    grounding: GroundingReport
    generated_by: Literal["GEMINI", "TEMPLATE_FALLBACK"]
    rounds_used: int                        # capped at 5
```
⭐ `tool_calls` is returned so the UI can show *"I called `list_compromised_shelters(district='PURI')` and got 11 results."* Visible reasoning beats a confident paragraph.

---

## 7. Static & meta endpoints

### `GET /shelters`
`?district=PURI&shelter_type=MCS`
Serves the banked OSDMA dataset — 877 records, independent of any run.

### `GET /meta/sources`
```python
class SourcesResponse(BaseModel):
    sources: list[SourceDescriptor]   # id, authority, url, licence, last_retrieved,
                                      # is_synthetic, role, confidence
```
⭐ Powers a "where does this data come from" panel. Directly serves the PRD honesty rule that every layer's provenance is visible.

### `GET /meta/limitations`
Returns the canonical limitations list from config — **one source of truth** shared by the UI panel, the advisory `caveats` field, and every `ModelDisclosure`.

### `GET /healthz`
```python
class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    gee_authenticated: bool
    gemini_reachable: bool
    gcs_writable: bool
    db_reachable: bool
    ai_enabled: bool                  # the kill switch state
    code_version: str
```
`degraded` (not failure) when Gemini is unreachable — **the product works on templates.** That distinction is the deployability story in one field.

---

## 8. Errors

```python
class Problem(BaseModel):
    type: str          # "https://prahari.dev/problems/aoi-too-large"
    title: str
    status: int
    detail: str
    instance: str | None
    errors: list[FieldError] | None
```

| Status | Type | When |
|---|---|---|
| 400 | `invalid-track-source` | no resolvable track |
| 404 | `run-not-found` / `storm-not-found` | — |
| 409 | `run-in-progress` | duplicate idempotency key, still running |
| 413 | `aoi-too-large` | bbox exceeds raster memory budget |
| 422 | `validation-error` | schema/range failure |
| 424 | `truth-unavailable` | `run_validation=true` for a storm with no SAR truth (e.g. Michaung) |
| 429 | `quota-exceeded` | GEE or Gemini limiter; `Retry-After` set |
| 500 | `hazard-model-error` | ⭐ science must **fail loudly**, never degrade silently |
| 503 | `dependency-unavailable` | GEE/GCS down |

> **Deliberate asymmetry:** an AI failure degrades to a template (200 + `TEMPLATE_FALLBACK`). A **hazard model failure returns 500.** We will serve a worse sentence, never a wrong number.

---

## 9. Middleware & app wiring

```python
app = FastAPI(title="PRAHARI API", version="1.0", docs_url="/api/v1/docs")

app.add_middleware(RequestIDMiddleware)        # propagates into worker jobs
app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(TimingMiddleware)           # per-stage histograms
app.add_middleware(QuotaMiddleware)            # GEE token bucket + Gemini RPM
app.add_middleware(GZipMiddleware, minimum_size=1024)
# ⚠️ No CORS middleware: Firebase Hosting rewrites /api/** to Cloud Run,
#    so the browser sees a single origin. Same-origin by architecture.
```

**Dependency injection**
```python
def get_gee_client() -> GEEClient: ...        # module-scope ee.Initialize(), never per-request
def get_artifact_store() -> ArtifactStore: ...
def get_run_repo() -> RunRepository: ...
def get_ai_client() -> AIClient: ...          # honours settings.enable_ai
def get_scenario_service(...) -> ScenarioService: ...
```

**Deployment**
```bash
gcloud run deploy prahari-api \
  --source . --region asia-south1 --allow-unauthenticated \
  --concurrency 80 --min-instances 1 --cpu 2 --memory 2Gi \
  --set-secrets GEMINI_API_KEY=gemini-key:latest,GEE_SA_KEY=gee-sa:latest

gcloud run jobs deploy prahari-worker \
  --source . --region asia-south1 \
  --cpu 2 --memory 4Gi --task-timeout 900s \
  --command python --args -m,prahari.workers.scenario
```

---

## 10. Contract tests

| # | Assertion |
|---|---|
| C1 | Every response containing a surge height includes `ModelDisclosure` |
| C2 | `SurgeEstimateOut.model_class` is always `"heuristic_index"` |
| C3 | `InundationOut.connectivity_enforced` is always `True` |
| C4 | `ZoneTrigger.basis` is always `"illustrative_not_actuarial"` |
| C5 | Every `Advisory` carries a `GroundingReport` and `generated_by` |
| C6 | `ValidationResponse.failure_analysis` is non-empty whenever `skill` is present |
| C7 | `POST /scenarios` with identical bodies returns the same `params_hash` |
| C8 | Relabeling a scenario (`label` only) yields a **cache hit** |
| C9 | `run_validation=true` on a truth-less storm returns **424**, never a fabricated score |
| C10 | `/healthz` reports `degraded`, not `error`, when only Gemini is down |
| C11 | Every GeoJSON response validates against RFC 7946 |
| C12 | No endpoint ever inlines a raster array |

> ⭐ **C1–C6 and C9 are the honesty rules compiled into tests.** The PRD says "never present a heuristic as validated"; C2 and C9 make that a build failure rather than a matter of discipline.
