# PRAHARI: submission

**Track:** Build with AI: Code for Communities, PS-05, Track-Based Cyclone
Impact & Infrastructure Vulnerability Forecaster.

## Pitch (2–3 lines)

India's cyclone warnings already save lives. What they don't do is say which
assets will flood. PRAHARI turns an IMD-stage storm track into named shelters
inside the surge zone, a capacity-aware evacuation plan, and time-stamped
orders for each official, using Earth Engine data, OR-Tools and Gemini
briefings whose every number is checked against the engine. For Cyclone Fani it
flags 29 of 241 register shelters in the modelled surge zone, and 3.5 lakh
people with no cyclone-shelter place within 10 km.

## What to look at (demo walkthrough, about 3 minutes)

1. **Storms** (`/`). Fani and Yaas are precomputed by the real pipeline.
   Storms with no configured coast say so instead of pretending to run.
2. **Orders** (`/scenarios/fani-2019-puri/orders`). The queue is grouped by IMD
   stage deadline, and each order is addressed to an office (the Collector of
   the right district, a BDO, the NDRF, the finance desk).
   - The evidence for each order carries a disclosure badge.
   - The stage briefing is written by Gemini, shows how it was produced, and
     has an **English / ଓଡ଼ିଆ** toggle.
   - Ticking an order records who ordered it, when, and at which stage.
   - Keyboard: `j`, `k` and `o`.
3. **Map** (`/map`) has **Ask this run**, where Gemini answers by function calling over the stored run and shows which tools it called. Try "How reliable is the flood extent?". The screen also shows:
   - surge-index depth bands (hue plus pattern) and the wind envelope;
   - the IBTrACS track and the register shelters;
   - block-by-block exposure;
   - the dual parametric trigger per block.
4. **Shelters** (`/shelters`). The flagship finding is named shelters inside
   the surge zone, with where to send their people. It also lists flood
   clusters with no shelter place, each with the reason. The three ways the
   finding can be wrong are stated above the table.
5. **Evidence** (`/evidence`). Sentinel-1 validation is reported as measured:
   CSI 0.001 for Fani, below the floor. The extent therefore stays heuristic,
   and the screen explains why, with a sensitivity sweep and a computed failure
   analysis.

## Google stack

| Service | Use |
|---|---|
| **Earth Engine** (project `prahari-24399`) | Copernicus GLO-30 DEM, JRC surface water, WorldPop 2019, Open Buildings v3 (counted server-side per flood cluster), Sentinel-1 GRD same-orbit change detection |
| **Gemini** (`google-genai`, Flash tier) | (1) Stage briefings, schema-constrained, then validated, repaired once, or replaced by a template; Odia is a separate translation that is validated again. (2) "Ask this run": function calling over 8 read-only tools on the stored run, capped at 5 rounds, with the answer re-validated against tool output |
| **Cloud Run + Firebase Hosting** | `Dockerfile`, `firebase.json` (`/api/**` rewrite, same origin), `deploy/deploy.ps1`. Prepared but **not deployed**: deploying needs billing approval |

## Run it locally

Backend:
```powershell
cd backend
py -3.11 -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -m uvicorn prahari.api.main:app --port 8080
```
The precomputed runs in `data/runs/` load with no keys.

Web:
```powershell
cd web
npm install
npm run dev
```
Open http://localhost:5173.

Optional live compute needs:
- `GEE_PROJECT` and `GEMINI_API_KEY` in `backend/.env`;
- `earthengine` authentication (see README).

To recompute a run:
```powershell
.venv/Scripts/python -m prahari.workers.scenario --storm FANI --season 2019 --aoi puri_khordha --validate --alias fani-2019-puri
```

## Checks (all run locally)

| Check | Command | Result |
|---|---|---|
| Backend tests | `pytest -m "not network and not gee"` | see EVALUATION.md, final round |
| Types / lint | `mypy --strict`, `ruff`, `tsc`, `eslint` (including token rules for `.css.ts`) | clean |
| Frontend tests | `vitest run` (adapter invariants, axe on every screen) | see EVALUATION.md |

## Honest limits

- The surge height is a heuristic index.
- The Fani extent fails validation (CSI 0.001).
- Capacities are imputed from shelter type.
- Road network, hospitals and power assets are not modelled.
- GDACS and IMD bulletin ingestion are not built.
- Nothing is deployed yet.

See `DEFENSE.md`.
