# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PRAHARI is a cyclone impact forecaster. Its pipeline runs: storm track, hazard (wind, surge, inundation), exposure, decisions (role-addressed orders and shelter assignment), parametric triggers, and validation against Sentinel-1 SAR.

Folder-specific commands and architecture:
- `backend/CLAUDE.md`: FastAPI, Python 3.11
- `web/CLAUDE.md`: React 19, Vite, TypeScript strict

The dev shell is PowerShell 5.1, so chain commands with `;` and not `&&`.

## What is real vs. stubbed
- **Real and tested:** the whole pipeline in `backend/prahari/workers/scenario.py`:
  - IBTrACS track and Earth Engine layers (`ingestion/layers.py`): GLO-30 DEM, JRC water, WorldPop, Open Buildings, Sentinel-1.
  - Hazard (`hazard/`), with lagoons split off as surge barriers.
  - Exposure (`exposure/`).
  - OR-Tools assignment and role-addressed orders (`decision/`).
  - The parametric trigger.
  - Sentinel-1 validation (`evals/validation.py`).
  - Gemini briefings behind the grounding validator (`ai/`).
- **Storage and API:** runs are stored as files under `data/runs/<run_id>/` (`storage/runs.py`) and served by `/scenarios/{id}/...`.
- **Frontend:** reads only the API. There are no fixtures. The map is deck.gl + MapLibre, lazily loaded.
- **Precomputed runs:**
  - `fani-2019-puri` and `yaas-2021-balasore` are stored in `data/runs/`.
  - Opening them needs no Earth Engine or Gemini key.
  - Recompute with `python -m prahari.workers.scenario --storm FANI --season 2019 --aoi puri_khordha --validate --alias fani-2019-puri`.
- **Not built:**
  - GDACS and IMD-bulletin track kinds (the API returns 400).
  - Road routing (straight line x 1.3).
  - Hospital and power assets.
  - Postgres/GCS storage.
- **Not deployed:** the config is `Dockerfile` (repo root, carries `data/`), `firebase.json` and `deploy/deploy.ps1`. Deploying needs billing approval.
- **Measured result to keep honest:** Fani's Sentinel-1 CSI is 0.001, below the 0.25 floor, so the extent is never shown as "validated". See `DEFENSE.md` section 4.

## Google Cloud project
- Use `prahari-24399` only, and always pass `--project prahari-24399`.
- Never run `gcloud config set project`. The user's default project belongs to other work.
- Earth Engine settings come from `GEE_PROJECT` in `backend/.env`.

## Cross-cutting invariants
- **Disclosure:** a modelled value must never be sent or shown without its disclosure (model class and a non-empty list of limitations).
  - Backend: `backend/prahari/models/disclosure.py`.
  - Frontend: the `DisclosureBadge` component, plus the `Disclosed<T>` brand in `web/src/types/disclosed.ts`.
- **Surge height is a heuristic index**, not a validated forecast. Credibility was meant to rest on the SAR-validated flood *extent*, but Fani's measured CSI is 0.001, so the extent is heuristic too and every screen says so.
- **Same-origin by design:**
  - In production, Firebase Hosting rewrites `/api/**` to the Cloud Run backend.
  - In dev, the Vite proxy mirrors that rewrite.
  - There is no CORS middleware, and none should be added.
- **Errors are RFC 9457 problem+json**, identified by a stable `type` URI (`https://prahari.dev/problems/<slug>`). The frontend maps each slug to an i18n key, so adding or renaming a slug means editing both `backend/prahari/api/errors.py` and `web/src/api/errors.ts`.
- **Data location:** `data/` lives at the repo root and is shared.
  - `data/raw/osdma_shelters.{csv,geojson}` (877 real shelters) is committed on purpose because it cannot be re-scraped. Never delete or regenerate it.
  - `data/raw/ibtracs_NI.csv` is gitignored. It is fetched with `make data`.

## Domain rules (README, PRD §9)
- Never claim that people die for lack of warning. India's warning system works, and the gap PRAHARI addresses is asset loss.
- The AI never produces a number. Gemini extracts structure and narrates results the engine has already computed. Every numeric claim is checked against deterministic output, and a failed check falls back to a template.
- Report the eval score that was actually measured. The expected CSI is 0.30–0.50. A CSI above 0.70 is treated as a bug signal (mask leakage or unmasked permanent water).
- Storm choice:
  - Build on **Fani**, the only Indian cyclone with a Copernicus EMS activation (EMSR357, not yet ingested).
  - Yaas is precomputed as a second coast; its same-orbit Sentinel-1 pair had nothing scorable, so it is not a validation demo.
  - Never validate on Michaung or Remal, because they have no usable post-landfall Sentinel-1 imagery.
- Never mix ascending and descending Sentinel-1 orbit passes between the pre-image and the post-image.
- Real names in the UI:
  - Shelter names and districts in the UI must come from the OSDMA register. Never invent one.
  - An unnamed register entry shows its id and says the name is missing.

## Docs
Read the relevant file in `docs/design/` before changing that area:
- `02`: architecture ADRs
- `03`: data layer
- `04`: AI layer
- `05`: evals
- `06`: API contracts
- `07`: frontend ADRs

`00-track-decision.md` and `01-PRD.md` are gitignored (kept local). They may be missing in a fresh clone.
