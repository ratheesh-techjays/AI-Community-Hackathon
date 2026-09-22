# PRAHARI — System Architecture

**Version** 1.0 · **Date** 2026-09-22 · **Backend** FastAPI (Python 3.11)

---

## 1. Architectural stance

> **PRAHARI is a deterministic computational pipeline with an LLM narration layer — not a CRUD application with AI features.**

Four consequences follow, and they shape every decision below:

| Principle | Implication |
|---|---|
| **P1 — The unit of work is an immutable `ScenarioRun`** | Every output is reproducible from `(track, params, code_version, data_version)`. Nothing is mutated in place. Re-running a scenario with identical inputs returns a cache hit, not a recomputation. |
| **P2 — Heavy compute never touches the request path** | Geospatial work runs as async jobs writing materialised artefacts. The API reads artefacts. Request latency is decoupled from model complexity. |
| **P3 — ⭐ The AI never produces a number** | Gemini extracts structure from documents and narrates computed results. **Every numeric claim in generated text must be traceable to a deterministic engine output**, enforced programmatically. This is the single most important guardrail in the system. |
| **P4 — Provenance is a first-class field, not documentation** | Every data value carries `source`, `confidence`, and `is_synthetic`. The PRD's honesty rules are enforced by the schema, not by good intentions. |

---

## 2. System context

```
┌───────────────────────────── EXTERNAL SOURCES ──────────────────────────────┐
│  IBTrACS (NOAA)   GDACS API   IMD bulletin PDF   Open-Meteo   OSM/Overpass  │
│  Earth Engine catalog: COP-DEM · Open Buildings · WorldPop · S1 GRD · GSW   │
│  OSDMA shelters (877, banked)        Copernicus EMS EMSR357 (Fani truth)    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                          PRAHARI BACKEND (FastAPI)                          │
│                                                                             │
│   L1 INGESTION ──▶ L2 HAZARD ──▶ L3 EXPOSURE ──▶ L4 DECISION ──▶ L5 AI     │
│        │               │              │               │            │        │
│        └───────────────┴──────────────┴───────────────┴────────────┘        │
│                                   │                                         │
│                      L6 EVAL HARNESS (offline, gates releases)              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   Artefact Store            Metadata DB              Vector/Raster
   (GCS: COG, GeoJSON,       (Postgres:               tiles → browser
    Parquet, run manifests)   runs, evals, audit)      (direct from GEE/GCS)
```

---

## 3. Layer decomposition

### L1 — Ingestion

**Responsibility:** turn heterogeneous external sources into canonical internal models, idempotently, with provenance.

```
prahari/ingestion/
├── base.py              # SourceAdapter ABC: fetch() → RawPayload, parse() → canonical
├── tracks/
│   ├── ibtracs.py       # historical + ACTIVE (same schema, one parser)
│   ├── gdacs.py         # live GeoJSON: track, forecast points, uncertainty cone
│   └── imd_bulletin.py  # PDF → Gemini structured extraction (L5 call)
├── hazard_inputs/
│   ├── dem.py           # COPERNICUS/DEM/GLO30_2024_1
│   └── meteo.py         # Open-Meteo archive/forecast (keyless)
├── exposure/
│   ├── buildings.py     # Open Buildings v3 polygons | temporal raster
│   ├── population.py    # WorldPop 100m / GHSL
│   ├── shelters.py      # OSDMA 877 (banked GeoJSON)
│   ├── health.py        # OSM amenity=hospital via Overpass
│   ├── power.py         # WRI/GPPD (native GEE) + OSM power=* + gridfinder
│   └── roads.py         # Geofabrik eastern-zone extract
└── truth/
    ├── sar.py           # Sentinel-1 VH-ratio flood mask (eval ground truth)
    └── ems.py           # EMSR357 Fani reference products
```

**Contract every adapter honours:**
```python
class SourceAdapter(ABC):
    source_id: str          # "ibtracs.ni.v04r01"
    provenance: Provenance  # authority, url, licence, retrieved_at, is_synthetic

    @abstractmethod
    def fetch(self, **params) -> RawPayload: ...   # cached by content hash
    @abstractmethod
    def parse(self, raw: RawPayload) -> list[BaseModel]: ...
    def validate(self, parsed) -> ValidationReport: ...  # schema + range checks
```

**Rules**
- Raw payloads are cached to GCS keyed by `sha256(source_id + params)`. **Fetch once, ever.**
- ⚠️ IBTrACS row 2 is a units row — skipped in the parser, asserted in a test.
- ⚠️ Track fields use `USA_*` (JTWC), never `WMO_*` or `NEWDELHI_*` — IMD's fields carry **no RMW at all**.
- A parse failure never crashes a request; it degrades to the last good cached payload and records a `DataFreshnessWarning`.

---

### L2 — Hazard engine

**Responsibility:** track → wind field → surge → inundation. **Pure, deterministic, no I/O.**

```
prahari/hazard/
├── track.py         # interpolation, RMW smoothing + fallback, landfall detection
├── holland.py       # Holland (1980) parametric wind field
├── surge.py         # empirical surge index (explicitly labelled heuristic)
├── inundation.py    # connectivity-constrained bathtub (scipy flood-fill)
└── grid.py          # AOI grid definition, CRS handling, resampling
```

**Holland wind field**
```
P(r) = Pc + (Pn − Pc)·exp[−(RMW/r)^B]
V(r) = sqrt[ B·(Pn−Pc)·(RMW/r)^B·exp(−(RMW/r)^B)/ρ + (rf/2)² ] − rf/2
```
`ρ = 1.15 kg/m³`. **B is not observed** — inverted from the cyclostrophic relation `B = Vmax²·ρ·e/ΔP`, clipped to `[1.0, 2.5]`.

> ⚠️ **RMW must never be used raw.** Fani's own IBTrACS rows read 30 → 5 → 12 → 5 nmi near peak. `track.py` applies a rolling median plus an empirical RMW-from-intensity fallback, and records which timesteps were imputed.

**Surge — the honesty-critical component**
```python
@dataclass(frozen=True)
class SurgeModel:
    """Calibrated illustrative index. NOT a validated forecast model.

    No published Bay-of-Bengal wind→surge formula exists; the real literature
    (Dube/Rao/Sinha, Johns 1985, Flather 1994) is dynamical shallow-water
    modelling. This is a transparent heuristic whose calibration table is
    surfaced in the UI and whose limitations ship with every response.
    """
    coefficient: float = 7.5e-4          # surge_m = c · Vmax_ms² · funnel_amp
    funnel_amplification: dict[str, float] = ...   # head-of-bay 1.6 / central 1.0 / TN 0.7
    calibration_rmse_m: float | None = None        # None until primary-source verified
    model_class: Literal["heuristic_index"] = "heuristic_index"
```
Every API response carrying a surge value includes `model_class` and the limitations block. **A surge height can never be serialised without them** — enforced by the response model.

**Inundation — connectivity is mandatory**
```python
from scipy import ndimage

def connected_inundation(dem, surge_level_m, ocean_mask):
    """Naive dem<threshold floods hydraulically disconnected depressions.
    Documented overestimate: Poulter & Halpin 2008, IJGIS."""
    candidate = (dem <= surge_level_m) & ~np.isnan(dem)
    labels, _ = ndimage.label(candidate | ocean_mask, structure=np.ones((3, 3)))
    ocean_ids = set(np.unique(labels[ocean_mask & (labels > 0)]))
    return np.isin(labels, list(ocean_ids)) & candidate
```
Runs in **Python/scipy on a pulled DEM array**, not GEE — `ee.Image.connectedComponents()` has `maxSize` friction on large contiguous floodplains.

**Why pure functions matter:** L2 is the scientific core. Being I/O-free makes it unit-testable, property-testable (monotonicity: higher surge ⇒ superset flood extent), and replayable in the eval harness without network access.

---

### L3 — Exposure engine

**Responsibility:** intersect hazard footprints with assets → counts and named asset lists per admin unit.

```
prahari/exposure/
├── engine.py        # zonal stats orchestration
├── raster_ops.py    # population-weighted overlay
├── vector_ops.py    # building/asset point-in-polygon, line clipping
└── aggregate.py     # roll up to village → block → district → state
```

**Two intersection strategies, chosen by layer type:**

| Asset type | Method | Output |
|---|---|---|
| Population (raster) | Zonal sum of WorldPop under flood mask | people at risk per admin unit |
| Buildings (polygons, or temporal raster) | Centroid-in-mask, or raster multiply | building count + total footprint area |
| Point assets (shelters, hospitals, power plants) | Point-in-mask | **named list** — "Shelter X is inside the surge zone" |
| Line assets (roads, power lines) | Clip to mask | km affected + severed-segment detection |

> ⭐ **The flagship exposure output: shelters that are themselves inside the surge zone.** With 877 real geocoded OSDMA shelters (177 in Puri alone), this is a concrete, named, checkable finding that no existing product surfaces.

**Scaling lever:** exposure is computed once per `(hazard_footprint_hash, exposure_snapshot_version)` and cached. Changing the *advisory wording* never recomputes exposure.

---

### L4 — Decision engine

**Responsibility:** convert exposure into optimised assignments, staged action packets, and parametric triggers.

```
prahari/decision/
├── shelter_assign.py    # OR-Tools min-cost flow
├── action_packets.py     # IMD-stage-aligned, role-addressed task generation
├── parametric.py         # PCRIC-style dual trigger
└── staging.py            # NDRF pre-positioning recommendation (P1)
```

**Shelter assignment — min-cost flow, not greedy**
```python
from ortools.graph.python import min_cost_flow

# Nodes: at-risk population clusters (supply) → shelters (demand = capacity)
# Cost: travel time along road network
# ⭐ Feasibility filter applied BEFORE graph construction, not as a constraint:
for pop_cluster in clusters:
    for shelter in shelters:
        if shelter.inside_surge_zone:      continue   # shelter itself floods
        if not shelter.road_connected:     continue   # NDMA §4.1.4 known gap
        if travel_time(pop_cluster, shelter) > hours_to_landfall: continue
        add_arc(...)
```
Pre-solve arc filtering keeps the model small and makes infeasibility *explainable* — "4,200 people in Ward 7 have no reachable shelter" is a headline finding, not an error.

**Action packets — aligned to IMD's verified stages**

| Stage | Lead | Generated artefact |
|---|---|---|
| Pre-Cyclone Watch | T-72h | vulnerability brief, shelter readiness checklist, staging recommendation |
| Cyclone Alert 🟡 | T-48h | ranked evacuation draft, feeder de-energization candidates |
| Cyclone Warning 🟠 | T-24h | final evacuation list + shelter assignment, road-cut predictions |
| Post-Landfall Outlook 🔴 | T-12h | shelter-in-place confirmation, expected damage manifest |

> ⚠️ **Stages get skipped.** IMD's SOP explicitly permits Alert without Watch and Warning without Alert for fast-intensifying systems — **Fani's Alert came at T-66h and Warning at T-36h.** The generator is driven by `hours_to_landfall`, not by an assumed four-step sequence, and emits a `compressed_timeline` flag when windows are missing.

**Parametric trigger — PCRIC dual-trigger pattern**
```python
trigger_a = source_in_a_shape(wind_field, parametric_zones, payout_matrix)
trigger_b = impacted_population_index(exposure, category_impact_factors)
payout    = max(trigger_a, trigger_b)     # pays the larger — exactly as PCRIC does
```
Zones are declared in versioned config, labelled `illustrative_not_actuarial`.

---

### L5 — AI layer

**Responsibility:** three bounded jobs. Nothing else.

```
prahari/ai/
├── client.py             # google-genai wrapper, retry, model pinning
├── extract_bulletin.py   # J1: IMD PDF → structured track  (multimodal)
├── narrate.py            # J2: computed results → official advisory (grounded)
├── query.py              # J3: NL question → tool calls over computed data
├── schemas.py            # Pydantic response schemas
├── prompts/              # versioned prompt templates
└── guards.py             # ⭐ numeric grounding validator
```

| Job | Input | Output | Guardrail |
|---|---|---|---|
| **J1 Extract** | IMD bulletin PDF/image | `TrackObservation` with per-field confidence | Schema-constrained; low-confidence fields flagged for review, never silently used |
| **J2 Narrate** | Computed exposure + decisions | Advisory text, English + Odia | **Numeric grounding validator** (below) |
| **J3 Query** | NL question | Tool calls → deterministic engines | AI selects tools; **engines compute** |

#### ⭐ The numeric grounding validator — P3 enforced

```python
def validate_grounding(generated: str, allowed: GroundingSet) -> GroundingReport:
    """Every number in generated text must appear in the computed payload.

    Rejects hallucinated figures — casualty counts, rupee amounts, building
    counts — before they can ever reach a District Collector's screen.
    """
    found = extract_numerics(generated)          # ints, floats, ranges, currency
    ungrounded = [n for n in found if not allowed.contains(n, tol=0.01)]
    return GroundingReport(ok=not ungrounded, ungrounded=ungrounded)
```
**On failure: one repair attempt with the violations named, then fall back to a deterministic template.** A rendered template is always acceptable; an ungrounded number never is. Every outcome is logged as an eval datapoint.

**Model policy**
- Pin an explicit model ID in config — **never `-latest`** in the demo path
- **Flash-tier only.** Pro was removed from the free tier on 1 Apr 2026 and free quotas were cut 50–80% in Dec 2025
- Billing enabled so the demo cannot 429 on stage
- `response_mime_type="application/json"` **+** `response_schema` together — mime type alone is only a soft hint
- Every call records `{model_id, prompt_version, tokens, latency, grounding_result}`

---

### L6 — Eval harness

Full design in [05-evals.md](05-evals.md). Architecturally it is **offline, gates releases, and shares L2's pure functions** — no separate reimplementation of the science.

---

## 4. Execution model — why the request path stays fast

```
POST /scenarios  ──▶  ScenarioRun(status=queued)  ──▶  202 + run_id
                              │
                              ▼
                      Cloud Run Job (async worker)
                      L1 → L2 → L3 → L4 → L5
                              │
                              ▼
                      Artefacts → GCS      Manifest → Postgres
                              │
GET /scenarios/{id}  ◀────────┘   (poll or SSE)   status=complete
GET /scenarios/{id}/layers/{name}  ──▶  signed GCS URL (CDN-served)
```

**Three tiers of latency:**

| Tier | Path | Target |
|---|---|---|
| **Hot** | Precomputed Fani/Yaas artefacts → GCS/CDN | **< 200 ms** |
| **Warm** | Cache hit on `params_hash` | < 500 ms |
| **Cold** | Full scenario compute as async job | 30 s – 3 min, polled |

> ⭐ **Demo reliability rule:** the live demo runs entirely on the **hot** tier. Fani and Yaas artefacts are materialised and committed. Live GEE computation is a *secondary* "run your own scenario" feature with a recorded fallback video. A live demo otherwise chains venue wifi + cold start + GEE latency + the 40-concurrent-request quota into one failure surface.

---

## 5. Scalability design

| Dimension | Bottleneck | Mitigation |
|---|---|---|
| **GEE concurrency** | ~40 concurrent requests/project, 100 req/s | Token-bucket limiter in the GEE client; precompute-first; high-volume endpoint (`earthengine-highvolume.googleapis.com`) |
| **Request throughput** | — | FastAPI is stateless; Cloud Run autoscales. `min-instances=1` during the demo window to kill cold start |
| **Compute cost** | Repeated identical scenarios | Content-addressed artefact cache — identical inputs are free forever |
| **Geographic scale** | India's whole coastline | AOI-tiled. Scaling from Puri to 96 coastal districts is **N parallel jobs**, not a bigger job. Architecture is coastline-generic; only `parametric_zones` and `funnel_amplification` are region-parameterised |
| **Raster memory** | DEM arrays at 30 m | Windowed reads (rasterio); AOI capped by bbox area with an explicit error above the limit |
| **Tile serving** | — | Browser fetches tiles **directly** from GEE/GCS. Only mapid negotiation passes through FastAPI — never pixel bytes |
| **DB load** | — | Postgres holds metadata only (KBs/run). All bulk data is in object storage |

**Multi-state scale-out is a config change, not a rewrite:**
```yaml
regions:
  odisha:   { funnel_amp: 1.6, parametric_zones: [...], shelters: osdma }
  wb:       { funnel_amp: 1.6, parametric_zones: [...], shelters: null }
  ap:       { funnel_amp: 1.0, parametric_zones: [...], shelters: null }
```

---

## 6. Deployment topology

| Component | Service | Config |
|---|---|---|
| API | **Cloud Run** (`prahari-api`) | concurrency 80, min-instances 1 (demo), asia-south1 |
| Workers | **Cloud Run Jobs** (`prahari-worker`) | 4 GiB / 2 vCPU for raster work, task timeout 900 s |
| Queue | **Cloud Tasks** | retry w/ exponential backoff, DLQ |
| Artefacts | **GCS** (`prahari-artifacts`) | versioned, lifecycle rules, public read for demo layers |
| Metadata | **Cloud SQL Postgres** | runs, evals, audit log, prompt versions |
| Analytics *(optional)* | **BigQuery** | eval history, exposure aggregates |
| Secrets | **Secret Manager** | GEE service-account key, Gemini API key |
| Frontend | **Firebase Hosting** | static build + `/api/**` rewrite → Cloud Run (single origin, **no CORS**) |

**Why Postgres over Firestore:** scenario runs, eval results, and audit records are relational and queried analytically (*"CSI across all runs of Fani by code version"*). Firestore would fight that. Firestore remains a reasonable choice for ephemeral UI state only.

---

## 7. Cross-cutting concerns

**Configuration.** `pydantic-settings`, env-driven, no secrets in code. Model IDs, GEE asset IDs, thresholds, and parametric zones all live in versioned config so the question "what if the threshold were different?" is a config flip, not a code change.

**Provenance & audit.** Every `ScenarioRun` manifest records input source hashes, code version (git SHA), config version, model IDs, prompt versions, and per-stage timings. **Any result on screen can be traced end-to-end.**

**Error taxonomy.**
```python
PrahariError
├── IngestionError      → degrade to cached payload, warn
├── ValidationError     → 422, field-level detail
├── HazardModelError    → fail the run (science must not silently degrade)
├── AIError             → fall back to deterministic template
└── QuotaError          → 429 + Retry-After, surfaced in UI
```

**Observability.** Structured JSON logs (Cloud Logging), request IDs propagated into worker jobs, per-stage timing histograms, a `/healthz` that checks GEE auth + Gemini reachability + GCS write.

**Testing.** L2 is property-tested (monotonicity, symmetry, energy sanity). L1 adapters tested against committed fixture payloads — **no network in CI**. L4 optimiser tested against hand-computed small instances. L5 tested against a golden set with the grounding validator asserted.

---

## 8. Repository layout

```
prahari/
├── api/            # FastAPI: routers, deps, middleware, response models
├── ingestion/      # L1 adapters
├── hazard/         # L2 pure science
├── exposure/       # L3
├── decision/       # L4
├── ai/             # L5 + guards
├── evals/          # L6 harness, golden sets, metrics
├── storage/        # GCS + Postgres repositories
├── gee/            # Earth Engine client, limiter, asset registry
├── models/         # shared Pydantic domain models
├── config/         # settings, parametric zones, asset IDs, region params
└── workers/        # Cloud Run Job entrypoints
data/
├── raw/            # osdma_shelters.{csv,geojson}  ← banked
├── fixtures/       # committed test payloads
└── golden/         # eval ground truth
docs/
```

---

## 9. Architecture Decision Records

### ADR-001 — FastAPI + async jobs over a monolithic request path
**Decision:** synchronous API for reads; heavy compute in Cloud Run Jobs.
**Why:** a full scenario is 30 s–3 min. Blocking HTTP would force timeout tuning and make the demo fragile. Job separation also gives free retry and isolates raster memory from the API process.
**Rejected:** Celery + Redis (extra infra to keep alive during a demo); in-process `BackgroundTasks` (lost on instance recycle).

### ADR-002 — Building footprints: Open Buildings v3 primary
**Decision:** `GOOGLE/Research/open-buildings/v3/polygons`, with the temporal raster as an optimisation and Microsoft GlobalMLBuildingFootprints / OSM as fallback.
**Why:** ✅ India coverage confirmed (`IND` explicit in the v3 country roster; 1.8B detections / 58M km²). It is Google's own dataset, which strengthens the "meaningful Google AI" criterion.
**Risk:** country-level inclusion ≠ dense detection in rural thatch-roof coastal villages. **Day-1 spot-check at Puri, Kakinada, Digha, Nagapattinam.** Adapter interface makes the swap a one-file change.

### ADR-003 — Copernicus DEM over SRTM
**Decision:** `COPERNICUS/DEM/GLO30_2024_1`.
**Why:** ⚠️ `COPERNICUS/DEM/GLO30` is **deprecated** and silently breaks. SRTM's several-metre vertical error is comparable to or larger than the surge signal itself in low-relief floodplains.

### ADR-004 — Hand-rolled Holland over CLIMADA
**Decision:** ~40 lines of numpy.
**Why:** CLIMADA v6.1.0 pulls **52 dependencies** including GDAL/fiona/cartopy/netCDF4; conda is the intended install path and pip is fragile — a real risk of losing a day to Cloud Run container builds. The numpy implementation was written and validated during research (Fani: derived B=1.756, correctly reproduces Vmax at r=RMW).

### ADR-005 — scipy flood-fill over GEE connectedComponents
**Decision:** connectivity in Python on a pulled DEM array.
**Why:** `ee.Image.connectedComponents()` has `maxSize` friction on large contiguous floodplains at coastline scale. scipy is simpler to build, debug, and unit-test, and keeps L2 I/O-free.

### ADR-006 — ⭐ AI narrates, never computes
**Decision:** no numeric value in user-facing text may originate from the LLM. Enforced by the grounding validator, with a deterministic template fallback.
**Why:** the failure mode that would most damage credibility is a hallucinated casualty or rupee figure presented to an official. This makes that structurally impossible rather than merely unlikely.

### ADR-007 — Precompute-first artefacts
**Decision:** demo AOIs materialised to GCS; live GEE is opt-in.
**Why:** removes venue wifi, cold start, GEE latency, and the 40-concurrent quota from the live demo path in one move.

### ADR-008 — Postgres over Firestore for run metadata
**Decision:** Cloud SQL Postgres.
**Why:** eval history and run comparison are inherently relational and analytical. Firestore would fight the primary query pattern.

### ADR-009 — Raw Gemini function calling over ADK
**Decision:** direct function calling for J3.
**Why:** a single agent with 3–5 tools needs no framework. ADK's 2.0 GA (May 2026) introduced breaking changes and the Gemini agentic surface moved to the Interactions API in 2026, so cached tutorials are stale — implementation-time risk with no benefit. What matters is the behaviour — multi-step tool use with explained reasoning — not the framework name.
