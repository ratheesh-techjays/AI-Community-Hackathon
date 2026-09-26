# CLAUDE.md: backend

FastAPI service for Python 3.11, packaged as `prahari` (hatchling). Run every command from `backend/`. See the root `CLAUDE.md` for cross-cutting rules.

## Commands
- Use `backend/.venv` (Python 3.11), then `pip install -e ".[dev]"`. The global Python has a TensorFlow/protobuf clash that breaks the `earthengine` CLI.
- `make` is not installed on the dev machine; run the Makefile commands directly.
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
- `make docker`: builds the Cloud Run image from the repo root (`Dockerfile`). The image carries `data/`, and Cloud Run injects `PORT`.
- `python -m prahari.workers.scenario --storm FANI --season 2019 --aoi puri_khordha --validate --alias fani-2019-puri`: runs and stores a scenario. It needs Earth Engine and, for the briefings, Gemini.

Pytest runs with `--strict-markers`. Register any new marker in `pyproject.toml`.

## Layout and layering
The package is organized by pipeline stage. Keep that direction: `api` imports from the domain layers, never the reverse.

| Dir | Layer |
|---|---|
| `ingestion/` | L1: IBTrACS (`tracks/`), the OSDMA register (`shelters.py`, the only loader), and Earth Engine layers (`layers.py`, behind the `LayerSource` protocol) |
| `hazard/` | L2: wind (`holland.py`), surge index (`surge.py`), connectivity flood-fill plus `split_water` for the sea and lagoons (`inundation.py`), and track handling (`track.py`) |
| `exposure/grid_exposure.py` | L3: flood clusters, building counts per cluster, shelter states, block rollups |
| `decision/` | L4: OR-Tools assignment with a greedy baseline, role-addressed action packets, and the parametric trigger |
| `ai/` | L5: Gemini client, grounding validator, and stage briefings |
| `evals/` | L6: metrics and Sentinel-1 scoring with computed failure analysis |
| `workers/scenario.py` | `run_pipeline`, the one entry point for both the CLI and the API |
| `api/` | routers, `service.py` (content-addressed runs on a background thread, capped at 1 concurrent run, HTTP 429 beyond), `auth.py`, `errors.py` |
| `storage/` | file-backed `RunStore` and the class-indexed PNG encoder |
| `models/results.py`, `models/scenario.py` | response shapes. The web app's `api/generated` types are generated from these |

- **Testing without the network:** tests replace Earth Engine with `tests/synthetic.py` (`SyntheticLayers`, `synthetic_track`) and Gemini with a scripted fake (`tests/unit/test_ai.py`).
- **Every `ScenarioService` in tests** must be given `ai=AIClient(Settings(enable_ai=False))`, or a test will call Gemini live.

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
- **Unmodellable storms:** for `aoi_preset: "auto"`, `service.check_track` runs `workers.scenario.check_modellable` before queueing anything. It returns 422:
  - `no-landfall`: the storm never made landfall, or formed over land;
  - `outside-coverage`: the landfall is off the configured coasts or outside the layers;
  - `track-too-short`: too few points with JTWC wind and pressure.
- **The failure asymmetry is deliberate:**
  - An AI or Gemini failure falls back to a template and returns 200.
  - `HazardModelError` returns 500 and must never be swallowed or degraded.
  - `TruthUnavailableError` returns 424. It is raised when validation is requested for a storm in `NO_SAR_TRUTH` (Michaung, Remal, Biparjoy), rather than fabricating a score.
- `/api/v1/healthz` makes real probes of Earth Engine, Gemini and the run store. Results are cached for 5 minutes.
- It reports `degraded`, never an error: precomputed runs and templates keep working.
- `/scenarios`:
  - Runs are files under `data/runs/`. A precomputed run can also be addressed by its `alias`.
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
- Scaling to a new region is a config change in `config/regions.py`, not a code change. `LANDFALL_COASTS` names the coast and funnel for a landfall; boxes are checked in order, first match wins.
- A landfall AOI names a flood cluster only from a register shelter within `ZONE_MAX_KM`. Beyond that it is located by coordinates, never named from a far shelter.

## Tests
- Tests are in `tests/unit/`.
- Property-based tests use `hypothesis`. `respx` is available for mocking httpx.
- The tests check scientific invariants rather than exact values. Examples:
  - connected inundation is a subset of the naive threshold;
  - flooded area is monotonic in surge level;
  - a CSI above 0.70 is flagged `suspicious`.
- Follow that style for new hazard and eval code.

## AI layer rules (`ai/`)
- The grounding set is exactly the numbers in that stage's prompt (`advisories._facts_for_prompt`), and nothing else.
- Integers must match exactly. Decimals may be rounded to 1–2 places, never to an integer.
- Scale words count (lakh, crore, hundred, thousand, million, billion, Odia ଲକ୍ଷ/କୋଟି/ହଜାର, Hindi लाख/करोड़). Numbers glued to letters count too ("5000people", "6m").
- Only the caller's `context` (storm label, real ids), `dates` and `times` (landfall and stage deadlines, in IST and UTC) are exempt.
- A money figure must say "illustrative".
- Query tools return ranked pages (`total`, `truncated`, `order`), so the model can't mistake page one for the whole list.
- Stage hours are accepted only in time phrases, such as "T-48h", "24 hours" or "72.0 ଘଣ୍ଟା".
- `BANNED_CLAIMS` rejects casualty wording and phrases such as "has been issued" or "communicated to".
- On a failure, Gemini gets one repair attempt, then the template is used.
- Odia is a separate translation and is validated again.
- `generated_by` is shipped to the UI.
- If a template states a number, that number must also be a prompt fact. The tests check this.
