# CLAUDE.md: backend

FastAPI service for Python 3.11, packaged as `prahari` (hatchling). Run every command from `backend/`. See the root `CLAUDE.md` for cross-cutting rules.

## Commands
- `pip install -e ".[dev]"`: install.
- `make data`: one-time IBTrACS NI download (27.9 MB) to `<repo>/data/raw/ibtracs_NI.csv`.
  - `GET /storms/{name}/track` returns 404 `storm-not-found` until you run it.
- `make dev`: uvicorn with reload on :8080. OpenAPI docs are at `/api/v1/docs` and the schema at `/api/v1/openapi.json`.
- `make test`: runs `pytest -m "not network and not gee"`, which needs no network, Earth Engine auth or API keys.
- `make test-all`: includes the tests marked `network` and `gee`.
- Single test: `pytest tests/unit/test_hazard.py::test_connectivity_excludes_disconnected_depression`.
- `make lint`: runs `ruff check`. Ruff uses line length 100, and its rules include `E F I N UP B SIM RUF`.
- `make fmt`: formats with ruff and applies ruff's auto-fixes.
- `make typecheck`: runs `mypy --strict` with the pydantic plugin. Every function needs full annotations.
- `make check`: lint, typecheck and tests.
- `make docker`: builds the Cloud Run image. The image includes GDAL, and Cloud Run injects `PORT`.

Pytest runs with `--strict-markers`. Register any new marker in `pyproject.toml`.

## Layout and layering
The package is organized by pipeline stage. Keep that direction: `api` imports from the domain layers, never the reverse.

| Dir | Layer | State |
|---|---|---|
| `ingestion/` | L1: IBTrACS (implemented), GDACS / IMD bulletin (TODO) | partial |
| `hazard/` | L2: `holland.py` wind field, `surge.py` heuristic index, `inundation.py` connectivity flood-fill, `track.py` RMW smoothing and landfall, `grid.py` | **implemented and tested** |
| `exposure/`, `decision/`, `ai/`, `gee/`, `storage/`, `workers/` | L3–L5 and infra | empty scaffolds |
| `evals/metrics.py` | L6: CSI/POD/FAR/bias against a SAR mask | implemented and tested |
| `models/` | Pydantic domain models (`track`, `hazard`, `disclosure`, `provenance`) | |
| `config/` | `settings.py` (env), `paths.py`, `regions.py` (region params, AOI presets), `assets.py` (pinned GEE asset IDs) | |
| `api/` | `main.py`, `errors.py`, `routers/` | |

### Hazard engine rules
- It must stay **pure numpy/scipy with no I/O**. This is what lets the tests run offline.
- Do not pull in CLIMADA or other heavy geo stacks (ADR-004 in `docs/design/02-architecture.md`).
- Inundation flood-fills from an ocean mask with 8-connectivity. Never replace it with a plain `dem <= level` threshold. `naive_threshold` exists only as a comparison reference.
- Surge calibration:
  - `SurgeModel.calibration_rmse_m` must stay `None`. A test asserts this.
  - Surge output always carries `ModelDisclosure.surge()`.
- RMW (radius of maximum wind):
  - Never use it raw.
  - `smooth_rmw` clamps it to `RMW_MIN_NMI..RMW_MAX_NMI`.
  - `smooth_rmw` falls back to `rmw_from_intensity` when a value is implausible or missing.
  - `smooth_rmw` flags every value it imputes.

### IBTrACS parsing (`ingestion/tracks/ibtracs.py`)
- Row 2 of the CSV is a units row. Skip it.
- Use the `USA_*` (JTWC) columns. `NEWDELHI_*` has no RMW, and `WMO_*` is only about 13% populated.

### GEE assets (`config/assets.py`)
- All Earth Engine IDs are pinned in this file. Never inline them elsewhere.
- The DEM is `COPERNICUS/DEM/GLO30_2024_1`. Plain `GLO30` is deprecated and fails silently.

## API conventions
- Every router is mounted under `/api/v1` in `api/main.py`. A new router must be added to the tuple there.
- A request-context middleware:
  - propagates `X-Request-Id`, or generates one if it is missing;
  - adds `Server-Timing`.
- `GZipMiddleware` is enabled.
- **Errors:** raise a `PrahariError` subclass from `api/errors.py`. Each subclass defines `slug`, `title` and `status`, and the handler renders problem+json.
  - Validation errors become 422 with a per-field `errors` list.
  - `QuotaExceededError` adds `Retry-After: 30`.
- **The failure asymmetry is deliberate:**
  - An AI or Gemini failure falls back to a template and returns 200.
  - `HazardModelError` returns 500 and must never be swallowed or degraded.
  - `TruthUnavailableError` returns 424. It is raised when validation is requested for a storm in `NO_SAR_TRUTH` (Michaung, Remal, Biparjoy), rather than fabricating a score.
- `/healthz` reports `degraded` rather than an error when only Gemini is missing. The product still works on templates. The GEE, GCS and DB probes are stubs for now.
- `/scenarios`:
  - An in-memory stub (`_RUNS`, `_BY_HASH`).
  - Runs are content-addressed by `params_hash`: a sha256 of the request (excluding the cosmetic `label` field) plus the code and config versions.
  - A repeated request returns `cache_hit=True`.
  - Keep `label` and any other cosmetic field out of the hash.
- Shelters:
  - `/shelters` reads the committed OSDMA CSV once (`lru_cache`).
  - District and type spellings are normalized through `DISTRICT_CANON` and `TYPE_CANON`.
  - Add a new data-quality alias there and not at the call sites.
- `/meta/limitations` serves the shared `SURGE_LIMITATIONS` and `PARAMETRIC_LIMITATIONS` lists from `models/disclosure.py`. Edit the limitations text in that one place.
- The frontend generates its types from `/api/v1/openapi.json` (`npm run api:check` in `web/`). A change to a response model is a contract change.

## Config
- `config/settings.py` is the only settings object. Read it through `get_settings()`, which is cached.
- Settings come from the environment or `.env`, which is gitignored. `.env.example` lists every variable.
- The Gemini models are Flash-tier only.
- `enable_ai=False` is the kill switch that forces full template fallback.
- `config/paths.py` resolves `data/` at the repo root (`parents[3]`). Override it with `PRAHARI_REPO_ROOT`, for example in Docker.
- Scaling to a new region is a config change in `config/regions.py`, not a code change.

## Tests
- Tests are in `tests/unit/`.
- Property-based tests use `hypothesis`. `respx` is available for mocking httpx.
- The tests check scientific invariants rather than exact values. Examples:
  - connected inundation is a subset of the naive threshold;
  - flooded area is monotonic in surge level;
  - a CSI above 0.70 is flagged `suspicious`.
- Follow that style for new hazard and eval code.
