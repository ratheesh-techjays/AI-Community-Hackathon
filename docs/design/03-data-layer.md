# PRAHARI — Data Layer Design

**Version** 1.0 · **Date** 2026-09-22

---

## 1. Data philosophy

> **Every value in the system knows where it came from, how much to trust it, and whether it is real.**

This is not documentation hygiene — it is the mechanism that enforces the PRD's honesty rules. A synthetic value cannot be rendered without its `is_synthetic` flag, and a heuristic surge height cannot be serialised without its `model_class`. The schema makes overclaiming structurally difficult.

### The provenance envelope

Every ingested entity carries:

```python
class Provenance(BaseModel):
    source_id: str              # "ibtracs.ni.v04r01"
    authority: str              # "NOAA NCEI"
    url: HttpUrl
    licence: str                # "public domain" | "CC-BY-4.0" | "ODbL"
    retrieved_at: datetime
    content_sha256: str         # the exact bytes we parsed
    is_synthetic: bool = False
    confidence: Confidence      # HIGH | MEDIUM | LOW | DERIVED
    caveats: list[str] = []     # ["RMW satellite-derived, no aircraft recon"]
```

**Rule:** `is_synthetic=True` propagates. Any derived artefact touching one synthetic input is itself flagged synthetic, and the UI must render the flag. No exceptions.

---

## 2. Source inventory — verified status

| # | Source | Access | Status | Role |
|---|---|---|---|---|
| S1 | **IBTrACS NI** v04r01 | HTTPS CSV, no auth | ✅ **verified** — 27.9 MB, 62,848 rows | Historical + ACTIVE tracks |
| S2 | **GDACS API** | HTTPS JSON, no auth | ✅ verified live | Live track + uncertainty cone |
| S3 | **IMD bulletin** | PDF/HTML | ✅ available, ❌ no JSON API | Gemini extraction source, authority citation |
| S4 | **Open-Meteo** | HTTPS, **no key** | ✅ **verified** — Puri 3 May 2019: 149.2 mm, 91.4 km/h | Rainfall/wind corroboration |
| S5 | **Copernicus DEM** `GLO30_2024_1` | GEE | ⚠️ needs GEE auth | Elevation for inundation |
| S6 | **Open Buildings v3** | GEE | ✅ India confirmed (`IND` in roster) | Building exposure |
| S7 | **WorldPop 100 m / GHSL** | GEE | ✅ native | Population exposure |
| S8 | **Sentinel-1 GRD** | GEE | ✅ granules confirmed for Fani/Yaas/Amphan | **Eval ground truth** |
| S9 | **JRC Global Surface Water** `GSW1_4` | GEE | ✅ native | Permanent-water mask |
| S10 | ⭐ **OSDMA shelters** | scraped → banked | ✅ **877 records in repo** | Shelter exposure + assignment |
| S11 | **WRI GPPD** | GEE `WRI/GPPD/power_plants` | ✅ native, zero ingestion | Power generation assets |
| S12 | **OSM** (hospitals, power, roads) | Overpass / Geofabrik | ✅ verified live | Critical infrastructure |
| S13 | **gridfinder** | Zenodo 3628142 | ⚠️ use Zenodo — `gridfinder.org` is squatted | Predicted distribution grid (fallback) |
| S14 | ⭐ **Copernicus EMS EMSR357** | web products | ✅ **only official EMS activation for any Indian cyclone** | Independent eval cross-check |

### What must be synthetic — and why that's fine

Nothing in the core pipeline requires synthetic data.

The only synthesised elements:
- **Parametric zone boundaries and payout matrices** — labelled `illustrative_not_actuarial`. Real zones need an actuary.
- **Shelter capacity** — OSDMA publishes locations but not capacities. Imputed from shelter *type* (MCS/MFS/NCRMP) using NDMA design norms, flagged `DERIVED`, with the imputation table visible in the UI.
- **Population cluster centroids** for shelter assignment — derived from WorldPop, flagged `DERIVED`.

---

## 3. Canonical domain models

```
prahari/models/
├── provenance.py
├── track.py
├── hazard.py
├── exposure.py
├── decision.py
└── run.py
```

### Track

```python
class TrackPoint(BaseModel):
    iso_time: datetime
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    max_wind_kt: float | None        # USA_WIND
    central_pressure_mb: float | None # USA_PRES
    env_pressure_mb: float | None     # USA_POCI
    rmw_nmi: float | None             # USA_RMW
    rmw_imputed: bool = False         # ⚠️ true when smoothed/filled
    storm_speed_kt: float | None
    storm_dir_deg: float | None
    dist2land_km: float | None

class CycloneTrack(BaseModel):
    sid: str                          # IBTrACS storm id
    name: str
    season: int
    basin: Literal["NI"]
    points: list[TrackPoint]
    landfall: LandfallEvent | None
    provenance: Provenance

    @model_validator(mode="after")
    def _monotonic_time(self):
        assert all(a.iso_time < b.iso_time for a, b in pairwise(self.points))
        return self
```

> **Field-source rule, encoded in the parser:** use `USA_*` (JTWC) columns only. IMD's `NEWDELHI_*` fields carry **no RMW at all**; `WMO_*` is only ~13% populated basin-wide. Per-storm `USA_RMW` fill: Fani 97%, Amphan 96%, Yaas 89%.

### Hazard

```python
class WindField(BaseModel):
    grid: GridSpec                    # bbox, resolution, CRS (EPSG:4326)
    max_sustained_ms: RasterRef       # GCS COG reference, not inline array
    holland_b: float = Field(ge=1.0, le=2.5)
    model: Literal["holland_1980"]
    provenance: Provenance

class SurgeEstimate(BaseModel):
    peak_surge_m: float
    funnel_amplification: float
    coefficient: float
    model_class: Literal["heuristic_index"]      # ⭐ never omitted
    limitations: list[str]                        # ⭐ never omitted
    calibration: CalibrationInfo | None           # None until primary-verified

class InundationFootprint(BaseModel):
    grid: GridSpec
    flood_mask: RasterRef
    surge_level_m: float
    connectivity_enforced: Literal[True]          # ⭐ type-level guarantee
    dem_asset: str                                # "COPERNICUS/DEM/GLO30_2024_1"
    dem_vertical_error_m: float                   # honesty: stated, not hidden
    area_flooded_km2: float
```

`connectivity_enforced: Literal[True]` means a non-connectivity-checked mask **cannot be constructed** — the type system prevents the Poulter & Halpin overestimate bug from shipping.

### Exposure

```python
class ExposedAsset(BaseModel):
    asset_id: str
    asset_type: AssetType             # SHELTER | HOSPITAL | POWER_PLANT | SUBSTATION | ROAD | BUILDING
    name: str | None
    geometry: GeoJSONGeometry
    hazard_bands: dict[str, float]    # {"flood_depth_m": 1.4, "max_wind_ms": 42.1}
    admin: AdminUnit
    provenance: Provenance

class ExposureSummary(BaseModel):
    admin: AdminUnit                  # village | block | district | state
    population_at_risk: int
    buildings_at_risk: int
    building_area_m2: float
    shelters_total: int
    shelters_compromised: int         # ⭐ inside surge zone — the flagship metric
    hospitals_at_risk: int
    road_km_affected: float
    power_assets_at_risk: list[str]   # named
    computed_at: datetime
    inputs_hash: str
```

### Run manifest — the reproducibility contract

```python
class ScenarioRun(BaseModel):
    run_id: UUID
    status: RunStatus                 # QUEUED | RUNNING | COMPLETE | FAILED
    request: ScenarioRequest
    params_hash: str                  # content address → cache key
    code_version: str                 # git SHA
    config_version: str
    data_versions: dict[str, str]     # {source_id: content_sha256}
    model_versions: dict[str, str]    # {"extract": "...", "narrate": "..."}
    prompt_versions: dict[str, str]
    artefacts: dict[str, ArtefactRef]
    stage_timings_ms: dict[str, int]
    warnings: list[Warning]
    eval_refs: list[UUID]
```

> ⭐ **`params_hash` is the cache key.** Identical inputs never recompute. It also means anyone asking *"can you reproduce that exact result?"* has a one-word answer: yes, from the manifest.

---

## 4. Storage strategy

### Three stores, clear boundaries

| Store | Holds | Why |
|---|---|---|
| **GCS** `prahari-artifacts` | Rasters (COG), vectors (GeoJSON/FlatGeobuf), tabular (Parquet), raw source cache, run manifests | Bulk bytes never belong in a DB. CDN-servable. Content-addressed. |
| **Cloud SQL Postgres** | Run metadata, eval results, audit log, prompt registry, asset catalogue | Relational + analytical queries |
| **BigQuery** *(optional)* | Eval history, exposure aggregates | Trend analysis across runs |

### GCS layout

```
prahari-artifacts/
├── cache/raw/{source_id}/{content_sha256}          # fetch-once-ever
├── static/                                          # version-pinned reference
│   ├── shelters/osdma_v2026-09-22.geojson
│   ├── admin/odisha_villages.fgb
│   └── parametric_zones/v1.geojson
├── runs/{run_id}/
│   ├── manifest.json
│   ├── wind_field.tif                               # COG
│   ├── flood_mask.tif                               # COG
│   ├── exposure.parquet
│   ├── exposed_assets.geojson
│   ├── decisions.json
│   └── advisories/{role}_{stage}_{lang}.json
├── demo/                                             # ⭐ precomputed hot tier
│   ├── fani_2019/...
│   └── yaas_2021/...
└── golden/                                           # eval ground truth
    ├── sar_flood_fani_2019.tif
    ├── emsr357/...
    └── bulletins/{id}.{pdf,json}
```

**Formats and why**
- **COG** for rasters — HTTP range reads, no server needed, `rasterio` windowed access
- **FlatGeobuf** for large static vectors — spatial index, streamable
- **GeoJSON** for run outputs — small, browser-native
- **Parquet** for tabular exposure — columnar, BigQuery-external-table ready

### Postgres schema (core tables)

```sql
CREATE TABLE scenario_runs (
    run_id          UUID PRIMARY KEY,
    status          TEXT NOT NULL,
    params_hash     TEXT NOT NULL,
    storm_sid       TEXT,
    aoi_name        TEXT,
    code_version    TEXT NOT NULL,
    config_version  TEXT NOT NULL,
    request         JSONB NOT NULL,
    data_versions   JSONB NOT NULL,
    model_versions  JSONB,
    artefacts       JSONB,
    stage_timings   JSONB,
    warnings        JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX ON scenario_runs (params_hash)
    WHERE status = 'COMPLETE';            -- ⭐ enforces the cache contract
CREATE INDEX ON scenario_runs (storm_sid, created_at DESC);

CREATE TABLE eval_results (
    eval_id       UUID PRIMARY KEY,
    run_id        UUID REFERENCES scenario_runs(run_id),
    suite         TEXT NOT NULL,          -- hazard_skill | extraction | grounding | decision
    metric        TEXT NOT NULL,          -- csi | iou | pod | far | field_accuracy
    value         DOUBLE PRECISION NOT NULL,
    threshold     DOUBLE PRECISION,
    passed        BOOLEAN,
    detail        JSONB,
    code_version  TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON eval_results (suite, metric, created_at DESC);

CREATE TABLE ai_calls (                   -- every LLM call, for eval + audit
    call_id          UUID PRIMARY KEY,
    run_id           UUID,
    job              TEXT NOT NULL,       -- extract | narrate | query
    model_id         TEXT NOT NULL,
    prompt_version   TEXT NOT NULL,
    input_sha256     TEXT NOT NULL,
    grounding_ok     BOOLEAN,
    ungrounded       JSONB,
    repair_attempted BOOLEAN DEFAULT false,
    fell_back        BOOLEAN DEFAULT false,
    latency_ms       INT,
    tokens_in        INT,
    tokens_out       INT,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE asset_catalogue (            -- static exposure assets
    asset_id     TEXT PRIMARY KEY,
    asset_type   TEXT NOT NULL,
    name         TEXT,
    geom         GEOGRAPHY(POINT, 4326),  -- PostGIS
    district     TEXT, block TEXT, village TEXT,
    attributes   JSONB,                   -- shelter type, capacity_imputed, etc.
    provenance   JSONB NOT NULL,
    source_id    TEXT NOT NULL
);
CREATE INDEX ON asset_catalogue USING GIST (geom);
CREATE INDEX ON asset_catalogue (asset_type, district);
```

> **PostGIS is worth the dependency** — point-in-polygon and nearest-shelter queries are the hot path for L3/L4, and doing them in SQL beats pulling everything into Python.

---

## 5. The OSDMA shelter dataset — banked

**Already extracted and committed:** `data/raw/osdma_shelters.{csv,geojson}` — **877 unique records.**

```json
{"name":"GUAGARIA","lat":21.86752819,"lon":87.2456223,"district":"BALASORE",
 "block":"GUAGARIA","village":"JALESWAR","shelter":"MFS(CMRF)",
 "location":"GUAGARIA","description":""}
```

Bounding box: lat 17.833–21.987 · lon 81.399–87.481. Matches OSDMA's own published claim of "879 shelters."

| District | n | | Shelter type | n |
|---|---|---|---|---|
| ⭐ **PURI** | **177** | | MFS(CMRF) | 186 |
| BALASORE | 144 | | NCRMP | 148 |
| KENDRAPARA | 117 | | MCS | 130 |
| BHADRAK | 103 | | NCRMP-AF | 111 |
| GANJAM | 102 | | MFS(St.Plan) | 110 |
| KHURDA | 51 | | IRCS | 63 |
| JAGATSINGPUR | 39 | | NCRMP_AF | 55 |
| *+20 others* | 144 | | *others* | 74 |

**⭐ Puri — the Fani landfall district — has the densest shelter coverage in the state. The demo AOI is the best-evidenced one.**

### Required cleaning (an ETL step, with tests)

| Issue | Fix |
|---|---|
| `JAGATSINGPUR` (39) vs `JAGATSINGHPUR` (5) | Normalise to one canonical district name |
| `NCRMP-AF` vs `NCRMP_AF` | Normalise separator |
| 6 records with blank shelter type | Set `UNKNOWN`, exclude from capacity imputation |
| `block` frequently duplicates `name` | Treat `block` as unreliable; trust `district` only |
| No capacity field | Impute from type using NDMA design norms → flag `DERIVED`, surface the table |
| Coordinate validity | Assert all points fall inside Odisha's bbox; 20 inland districts are legitimate (flood shelters) |

```python
CANONICAL_DISTRICT = {"JAGATSINGPUR": "JAGATSINGHPUR", ...}
SHELTER_TYPE_NORM  = {"NCRMP_AF": "NCRMP-AF", ...}

# capacity imputation — illustrative, flagged DERIVED
CAPACITY_BY_TYPE = {"MCS": 1000, "MFS(CMRF)": 500, "NCRMP": 1000, ...}
```

---

## 6. Pipelines

### P1 — Static reference build (run once, rarely)
```
OSDMA scrape ──▶ clean/normalise ──▶ validate ──▶ GCS static/ + asset_catalogue
OSM Overpass ──▶ hospitals/power ──▶ dedupe ──▶ asset_catalogue
Geofabrik    ──▶ roads (eastern zone) ──▶ clip to AOI ──▶ FlatGeobuf
Admin bounds ──▶ village/block/district ──▶ FlatGeobuf + PostGIS
```
Idempotent, versioned by date. `osdma_v2026-09-22.geojson` is pinned in config so a re-scrape can never silently change results.

### P2 — Scenario compute (per run)
```
1. resolve track      (IBTrACS sid | GDACS live | Gemini-extracted bulletin | manual)
2. interpolate + smooth RMW, detect landfall
3. Holland wind field  → COG
4. surge index         → scalar + caveats
5. pull DEM window     → array
6. connectivity bathtub → flood mask COG
7. exposure intersect  → Parquet + GeoJSON  (PostGIS-assisted)
8. shelter assignment  → min-cost flow
9. action packets      → per role × stage
10. parametric trigger → per zone
11. Gemini narration   → grounding-validated advisories
12. write manifest, register run
```
Every stage writes its artefact before the next begins. **A failed run is resumable from its last completed stage** — critical when iterating under time pressure.

### P3 — Eval (offline, gates releases)
```
SAR truth build ──▶ golden/sar_flood_fani_2019.tif   (one-time)
predicted mask  ──▶ confusion matrix ──▶ CSI/IoU/POD/FAR ──▶ eval_results
golden bulletins ──▶ J1 extraction ──▶ field accuracy ──▶ eval_results
computed payloads ──▶ J2 narration ──▶ grounding rate ──▶ eval_results
```

---

## 7. Caching & idempotency

| Level | Key | TTL |
|---|---|---|
| Raw source payloads | `sha256(source_id + params)` | ♾️ forever (content-addressed) |
| GEE derived rasters | `sha256(asset_id + bbox + date_range + ops)` | ♾️ |
| Scenario run | `params_hash` | ♾️ (unique index enforces it) |
| Live feeds (GDACS, Open-Meteo forecast) | url + hour bucket | 1 h |
| Signed artefact URLs | — | 15 min |

```python
def params_hash(req: ScenarioRequest, data_versions: dict, code_version: str) -> str:
    payload = {
        "request": req.model_dump(mode="json", exclude={"label", "requested_by"}),
        "data_versions": dict(sorted(data_versions.items())),
        "code_version": code_version,
        "config_version": settings.config_version,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
```
Cosmetic fields are excluded so relabeling a run doesn't bust the cache.

---

## 8. Data quality gates

Enforced in CI; a failure blocks the build.

| Gate | Assertion |
|---|---|
| **G1 IBTrACS parse** | Row 2 (units) skipped; Fani `SID` present; 71 Fani rows; `USA_RMW` ≥90% populated for Fani |
| **G2 RMW sanity** | No RMW < 3 nmi survives smoothing; `rmw_imputed` set wherever filled |
| **G3 Shelter integrity** | 877 records; zero null coords; all inside Odisha bbox; district names canonical |
| **G4 DEM asset** | Asset ID is `GLO30_2024_1`, **not** deprecated `GLO30` |
| **G5 Connectivity** | Flood mask is a strict subset of naive threshold mask, and is 4/8-connected to the ocean seed |
| **G6 Monotonicity** | surge_level ↑ ⇒ flood area monotonically ↑ (property test) |
| **G7 Provenance completeness** | Every serialised entity has non-null `provenance.source_id` and `confidence` |
| **G8 Synthetic propagation** | Any artefact with a synthetic input has `is_synthetic=True` |
| **G9 Surge envelope** | `SurgeEstimate` cannot serialise without `model_class` and `limitations` |
| **G10 SAR orbit consistency** | 🔴 Pre and post Sentinel-1 scenes share `orbitProperties_pass`. **Mixing ascending/descending creates false flooding from look-angle alone — the #1 demo-wrecking bug.** |

---

## 9. What we deliberately do not store

- **No personal data.** Population is raster aggregate only; no individuals, no households.
- **No real-time IMD scraping into the demo path.** GDACS is the live feed; IMD is a citation and Gemini-grounding source.
- **No credentials in code.** GEE service-account key and Gemini key live in Secret Manager.
- **No mutable "current state."** There is no single "current forecast" row. Every view is a `ScenarioRun`, which is why results are always attributable.
