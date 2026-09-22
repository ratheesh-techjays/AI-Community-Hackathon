# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PRAHARI is a cyclone impact forecaster. Its pipeline runs: storm track, hazard (wind, surge, inundation), exposure, decisions (role-addressed orders and shelter assignment), parametric triggers, and validation against Sentinel-1 SAR.

Folder-specific commands and architecture:
- `backend/CLAUDE.md`: FastAPI, Python 3.11
- `web/CLAUDE.md`: React 19, Vite, TypeScript strict

The dev shell is PowerShell 5.1, so chain commands with `;` and not `&&`.

## What is real vs. stubbed
- **Real and tested:** the backend hazard engine (`backend/prahari/hazard/`), eval metrics, and the storms, shelters and meta endpoints.
- **Stubbed:**
  - Exposure, decision, AI (Gemini), GEE and storage are scaffolds marked with `TODO(owner)`.
  - `/scenarios` is an in-memory stub.
  - The frontend renders **fixture data** (Fani, Puri, T-48h) and does not yet call the API.
  - The map is a hand-drawn SVG, not deck.gl.
- Keep the fixture and live shapes identical. The fixtures are written to match the planned contracts in `docs/design/06-api-contracts.md`, so that switching a screen to the live API is a one-line change.

## Cross-cutting invariants
- **Disclosure:** a modelled value must never be sent or shown without its disclosure (model class and a non-empty list of limitations).
  - Backend: `backend/prahari/models/disclosure.py`.
  - Frontend: the `DisclosureBadge` component, plus the `Disclosed<T>` brand in `web/src/types/disclosed.ts`.
- **Surge height is a heuristic index**, not a validated forecast. Credibility rests on the SAR-validated flood *extent*.
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
  - Build on **Fani**, the only storm with the EMSR357 Copernicus EMS cross-check.
  - Demo on **Yaas**.
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
