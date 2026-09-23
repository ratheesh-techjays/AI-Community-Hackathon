# PRAHARI

**प्रहरी** · *sentinel* · **P**redictive **R**isk & **A**nticipatory **H**azard **R**esponse **I**ntelligence

> An AI decision layer that turns a cyclone forecast into building-level damage predictions, time-stamped orders for named officials, and insurance payouts that trigger *before* landfall.

Built for **Build with AI: Code for Communities — Second Edition** (Google Cloud × Hack2skill), **Problem Statement 05 — Track-Based Cyclone Impact & Infrastructure Vulnerability Forecaster**.

---

## The problem

### India already solved the hard part. That's the point.

India's cyclone early-warning system is one of the great disaster-risk-reduction successes anywhere in the world:

| | 1999 Odisha Super Cyclone | Fani (2019) | Yaas (2021) |
|---|---|---|---|
| **Deaths** | ~10,000 | **64** | **20** |
| **Evacuated** | — | >1.2 million | >1 million |

IMD's landfall-point forecast accuracy improved **30–60%** at 72-hour lead time between 2014–18 and 2019–23. Odisha runs **122 siren towers covering 1,205 villages**. There are **879+ purpose-built cyclone shelters** and trained Village Task Forces in every coastal panchayat.

**So PRAHARI does not warn people. That is already handled, and claiming otherwise would be false.**

### The gap is assets, and it is widening fast

**Cyclone Amphan (2020) caused roughly $13.5 billion in damage in West Bengal alone — the costliest cyclone ever to strike India — while killing 103 people in India.** Compare 1999: ~$4.5B damage, ~10,000 deaths.

**The damage-to-death ratio has grown by roughly two orders of magnitude.** Warnings save lives. They do not yet protect infrastructure.

### Why? Because every warning in the chain is a *meteorological* statement

IMD issues a scientifically excellent bulletin: *"a storm tide of 3.0–4.5 m is expected near Puri."* It goes, as a PDF, to Chief Secretaries and named District Collectors.

Nobody converts that sentence into:

- *Which* 14,000 specific buildings flood
- *Which* 3 substations and 11 km of feeder line go under
- ⚠️ *Which* **cyclone shelters are themselves inside the surge zone**
- *Which* villages lose the only road to their assigned shelter
- *What* the District Collector of Puri must order, by which hour
- *How much* money should be released automatically at T-48h

Today that translation happens in a human head, under time pressure, from a PDF.

### What we checked, and did not find

Researching this honestly, we could not locate:

1. **Any building- or asset-level inundation product for India.** Every verified official product — IMD's Storm Surge Warning, track bulletins, the GIS interactive track tool, NCMRWF's NCUM models — operates at regional or district scale. None ingests power-grid, substation, road, or hospital asset data.
2. **Any system that generates per-official action items.** The whole IMD → NDMA → SDMA → Collector chain runs on PDF bulletins and human judgment against static guidelines.
3. **Any parametric cyclone insurance for an Indian east-coast state.** A direct World Bank project-database query for *"parametric insurance India"* returns **zero results**. India's mechanisms remain SDRF/NDRF — ex-post fiscal transfers, months after the event.
4. **Structured post-event damage data — even retrospectively.** Official power-grid damage figures for Fani and Amphan could not be traced to any primary source. If that data doesn't exist cleanly *after* the fact, there is certainly no live predictive layer.

**And Google Flood Hub structurally cannot fill this gap** — Google's own research documentation scopes its models to *"riverine floods and flash floods in urban areas"*, with no mention of coastal or storm-surge flooding.

---

## What PRAHARI does

A six-stage pipeline from storm track to actionable decision.

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ 1 INGEST     │──▶│ 2 HAZARD     │──▶│ 3 EXPOSURE   │
 │ IMD bulletin │   │ Holland wind │   │ buildings ×  │
 │ + IBTrACS    │   │ + surge      │   │ population × │
 │ (Gemini OCR) │   │ + inundation │   │ infra assets │
 └──────────────┘   └──────────────┘   └──────┬───────┘
                                              │
 ┌──────────────┐   ┌──────────────┐   ┌──────▼───────┐
 │ 6 VALIDATE   │◀──│ 5 TRIGGER    │◀──│ 4 DECIDE     │
 │ vs Sentinel-1│   │ parametric   │   │ action packs │
 │ SAR truth    │   │ payout calc  │   │ + shelter    │
 │ CSI / IoU    │   │              │   │   assignment │
 └──────────────┘   └──────────────┘   └──────────────┘
```

**1. Ingest** — IBTrACS best-track for historical replay (built). GDACS live storms and **Gemini multimodal reading IMD's bulletin PDF** are the next ingestion step: the API rejects those track kinds today (HTTP 400) rather than faking them.

**2. Hazard** — Holland (1980) parametric wind field, an explicitly-labelled surge index, then **connectivity-constrained bathtub inundation**: we flood-fill from the ocean rather than thresholding elevation, because naive thresholding floods hydraulically disconnected inland basins and invents lakes.

**3. Exposure** — intersect the hazard footprint with individual building footprints (Google Open Buildings), 100 m population rasters, and **877 real geocoded OSDMA cyclone shelters**. Hospitals, roads and power assets are the next layers; they are not ingested yet.

**4. Decide** — OR-Tools min-cost-flow assigns at-risk population to shelters by imputed capacity and road distance (straight line × 1.3; no road network yet), and generates role-addressed action packets aligned to IMD's four warning stages (**72h / 48h / 24h / 12h**, verified verbatim from IMD's July 2024 SOP).

**5. Trigger** — a PCRIC-style dual parametric trigger (wind-in-zone vs. impacted-population index, paying the larger), so liquidity can be released pre-landfall instead of months after.

**6. Validate** — replay Fani, compare our predicted inundation against **observed Sentinel-1 SAR flood extent** (same relative orbit pre and post), and report Critical Success Index honestly. **Measured for Fani: CSI 0.001**, below the 0.25 floor, so the extent stays heuristic everywhere in the app. The truth mask was checked: it matches JRC permanent water (IoU 0.73, best at zero shift). The masks are aligned; they disagree. See `DEFENSE.md` §4.

### The three things nobody else is doing

**⭐ Building-level exposure, not district choropleths.** Everyone shades a district polygon red. We intersect the hazard with individual building footprints and a population raster.

**⭐ A backtest against real satellite truth.** We replay Cyclone Fani and score predicted flood extent against what Sentinel-1 actually observed — with **`EMSR357`, the only official Copernicus EMS activation for any Indian cyclone that exists,** as the independent reference to ingest next (not yet ingested). (Verified by enumerating every India/Bangladesh activation; Yaas, Michaung, Remal and Biparjoy have none.)

**⭐ Decisions and payout triggers as the output artefact.** Not a map. A time-stamped, role-addressed order set, plus a computed payout figure.

### The flagship finding

**Cyclone shelters that are themselves inside the surge zone.**

With 877 real geocoded shelters — 177 in Puri, the Fani landfall district — PRAHARI produces a named, checkable list of shelters that would flood, and villages with no reachable shelter at all. NDMA's own 2008 guidelines flag that many older shelters are not all-weather road-connected. Nobody models this today.

---

## Who it's for

Derived from NDMA's own guidelines, where the District Collector as DDMA chair is *"the very bedrock of the entire DM apparatus."*

| User | Their real decision | What PRAHARI gives them |
|---|---|---|
| **District Collector** (primary) | Which zones to evacuate, when, to which shelters | Evacuation orders per block and IMD stage deadline: people per flood cluster, assigned shelter, estimated distance (road status not modelled yet) |
| **State Relief Commissioner** | Where to concentrate resources; when to sound sirens | Cross-district severity comparison; shelter capacity vs. demand gap |
| **Power utility control room** | Which feeders to de-energize; where to pre-stage crews | *Planned:* substations and feeders inside the footprint. Power assets are **not ingested yet**, so no power orders are generated today |
| **NDRF staging officer** | Where to pre-position teams — **currently decided with no algorithm at all** | Pre-positioning orders at the largest flood clusters with no shelter place (a ranking, not an optimisation yet) |
| **State finance / DRF desk** | Whether a parametric threshold is crossed | Trigger status and computed payout per zone, with evidence |

---

## Quick start

### Backend (FastAPI, Python 3.11)

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows; use .venv/bin/activate elsewhere
pip install -e ".[dev]"
make data          # downloads IBTrACS NI basin (27.9 MB, one time; needed only to recompute)
make test          # pytest -m "not network and not gee": no network, no keys
make dev           # http://localhost:8080/api/v1/docs
```

Without `make` (Windows PowerShell), run the Makefile commands directly, e.g.
`.venv/Scripts/python -m uvicorn prahari.api.main:app --port 8080`.

The precomputed runs in `data/runs/` (`fani-2019-puri`, `yaas-2021-balasore`)
open with no Earth Engine or Gemini key. To recompute one:

```bash
python -m prahari.workers.scenario --storm FANI --season 2019     --aoi puri_khordha --validate --alias fani-2019-puri
```

### Frontend (React 19, Vite, TypeScript strict)

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (proxies /api -> :8080)
npm run check      # typecheck + lint + token lint (.css.ts) + tests
```

> The dev server proxies `/api` to the backend, mirroring the Firebase Hosting rewrite used in production. **This is why the backend has no CORS middleware — everything is same-origin by architecture.**

---

## Before writing any code: three checks

Two need a browser login and cannot be scripted.

**1. Register Earth Engine** — immediate, self-service, no billing for non-commercial:
```
https://code.earthengine.google.com/register?project=YOUR_PROJECT
```
```bash
python -c "import ee; ee.Initialize(project='YOUR_PROJECT'); print(ee.Image('USGS/SRTMGL1_003').getInfo()['bands'][0]['id'])"
```

**2. Spot-check Open Buildings density.** Country coverage is confirmed (`IND` is in the v3 roster), but that doesn't guarantee dense detection in rural thatch-roof villages:
```python
import ee; ee.Initialize(project="YOUR_PROJECT")
ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons") \
  .filterBounds(ee.Geometry.Point([85.83, 19.81])).size().getInfo()   # Puri
```
Also check Kakinada, Digha, Nagapattinam. Fallback: `microsoft/GlobalMLBuildingFootprints` or OSM.

**3. Check Gemini limits** at <https://aistudio.google.com/rate-limit>, confirm the exact model ID, and **enable billing** — Pro was removed from the free tier on 2026-04-01 and free quotas were cut sharply in Dec 2025. Flash pricing makes a demo day cost a few dollars.

---

## Repository layout

```
backend/          FastAPI service
  prahari/
    config/       settings, GEE asset IDs, region params, paths
    models/       Pydantic domain models (+ the disclosure contract)
    hazard/       L2: Holland wind field, surge index, inundation  <- pure, tested
    ingestion/    L1: IBTrACS, OSDMA register, Earth Engine layers (DEM, water, WorldPop, Open Buildings, Sentinel-1)
    exposure/     L3: hazard x asset intersection
    decision/     L4: shelter assignment, action packets, parametric triggers
    ai/           L5: Gemini extract / narrate / query + grounding validator
    evals/        L6: CSI/IoU skill metrics
    api/          routers, RFC 9457 error taxonomy
  tests/
web/              React frontend
  src/
    design/       token contract (the ONLY place raw literals live)
    api/          transport layer, interceptors, QueryClient, key factory
    features/     feature-sliced UI
    map/          deck.gl layers
    types/        Disclosed<T> -- the honesty guarantee
data/raw/         osdma_shelters.{csv,geojson}  <- 877 real shelters, committed
docs/design/      PRD, architecture, data layer, AI layer, evals, API, frontend
```

### Build status

Measured on this branch; the commands and outputs are in `EVALUATION.md`.

| | |
|---|---|
| Backend tests | see `EVALUATION.md` (final round) — no network, no auth, no API keys required |
| Static checks | `mypy --strict`, `ruff`, `tsc --noEmit`, `eslint --max-warnings 0` all clean |
| Bundle | initial JS ~114 kB gzipped (React, router, TanStack Query and the shell); each screen and the map (deck.gl + MapLibre, ~529 kB gz) load on demand; `dist/index.html` preloads nothing else |

**Built and tested:** L1 IBTrACS and Earth Engine layers, L2 hazard, L3 exposure,
L4 OR-Tools assignment and role-addressed orders, L5 Gemini briefings behind a
grounding validator, the parametric trigger, L6 Sentinel-1 validation, and the
content-addressed scenario API with file-backed run storage.
**Not built:** GDACS and IMD bulletin ingestion, road routing, hospital and
power assets, Postgres/GCS storage and Cloud Tasks. **Not deployed:** the
Cloud Run and Firebase config is ready in `Dockerfile`, `firebase.json` and
`deploy/deploy.ps1`.

---

## The four rules that matter

Read `docs/design/01-PRD.md` §9 in full. The short version:

**1. Never claim people die for lack of warning.** India's evacuation system works. Saying otherwise is false, and anyone who knows the domain will catch it. The gap is *asset* loss.

**2. The AI never produces a number.** Gemini narrates computed results. Every number it writes must be one the prompt gave it, and a claim lint rejects casualty wording and "has been issued"-style assertions. A failure gets one repair attempt, then the deterministic template, and the UI shows which one you are reading. The validator checks digits, not numbers written as words; the prompt forbids those, and `05-evals.md` measures what slips through rather than assuming it is zero.

**3. A modelled value never renders without its disclosure.** Enforced end to end: `Literal` types in Pydantic, contract tests in the test suite (C1–C12 in `backend/tests/`, run by `.github/workflows/ci.yml` — configured, not yet run on GitHub), and disclosure badges fed by the server's own limitations in React.

**4. Report the eval score we get, not the one we want.** Expected CSI is **0.30–0.50** for a parametric model; calibrated hydrodynamic models reach 0.60–0.80. A score above **0.70 is treated as a bug signal** — mask leakage or unmasked permanent water — not a win.

---

## Data provenance

| Source | Status |
|---|---|
| IBTrACS NI v04r01 | ✅ verified — 62,848 rows; Fani parsed to 71 points |
| OSDMA shelters | ✅ **877 geocoded records, committed** (177 in Puri) |
| Open-Meteo | ✅ keyless; corroborates Fani — Puri 2019-05-03: 149.2 mm, 91.4 km/h |
| Copernicus DEM | ⚠️ use `GLO30_2024_1` — plain `GLO30` is **deprecated and silently breaks** |
| Open Buildings v3 | ✅ India confirmed in the v3 country roster |
| Sentinel-1 GRD | ✅ granules confirmed for Fani / Yaas / Amphan |
| Copernicus EMS | ⚠️ `EMSR357` (Fani) exists — the only Indian cyclone activation — but is **not yet ingested** |

### Traps that will cost you a day

- **IBTrACS row 2 is a units row.** Skip it.
- **Use `USA_*` (JTWC) columns.** IMD's `NEWDELHI_*` fields carry **no RMW at all**; `WMO_*` is ~13% populated basin-wide.
- **Never use RMW raw.** Fani's rows read 30 → 5 → 12 → 5 nmi near peak. 5 nmi is a Dvorak artefact. We median-smooth with an intensity fallback and flag every imputed value (12/71 for Fani).
- **Never mix ascending and descending Sentinel-1 orbit passes** between pre- and post-images. Look-angle difference alone creates false "flooding" that will visibly wreck the demo.
- **Storm selection is not arbitrary.** Build on **Fani** (the only storm with an independent official cross-check). Yaas is precomputed as a second coast; its same-orbit Sentinel-1 pair had nothing scorable, and the app says so. ❌ Never **Michaung** or **Remal** — no usable post-landfall Sentinel-1 imagery exists, because Sentinel-1B was lost in Dec 2021 and revisit degraded from ~6 to ~12 days.

### What is honestly uncertain

**No published Bay-of-Bengal wind-to-surge formula exists.** The real literature (Dube/Rao/Sinha, Johns 1985, Flather 1994) is dynamical shallow-water modelling, not a plug-in equation. Our surge output is therefore a **transparent heuristic index**, labelled as such in the type system, the API response, and the UI — and `calibration_rmse_m` stays `None` until someone verifies against IMD's per-cyclone Preliminary Reports.

**Credibility was meant to rest on the SAR-validated flood extent, never on the surge height.** Measured for Fani, the extent failed (CSI 0.001); the app says so on every screen that shows an order, and nothing is badged validated.

---

## Scaling beyond Odisha

The architecture is coastline-generic. Moving from Puri to all 96 coastal districts is **N parallel jobs, not a bigger job** — only `funnel_amplification` and `parametric_zones` are region-parameterised, as YAML config.

Beyond India: **IMD is the WMO-designated Regional Specialized Meteorological Centre for the entire North Indian Ocean, serving 13 countries** (Bangladesh, Maldives, Myanmar, Pakistan, Sri Lanka, Oman, Yemen, Thailand, Iran, Saudi Arabia, Qatar, UAE). A tool built on IMD's bulletins is regionally exportable by institutional design, not by aspiration.

---

## Docs

| Doc | Read it when |
|---|---|
| `docs/design/00-track-decision.md` | you want to know why PS-05 over the other four |
| `docs/design/01-PRD.md` | before writing any feature |
| `docs/design/02-architecture.md` | before adding a module (9 ADRs) |
| `docs/design/03-data-layer.md` | before touching data or schemas |
| `docs/design/04-ai-layer.md` | before touching Gemini |
| `docs/design/05-evals.md` | before claiming anything works |
| `docs/design/06-api-contracts.md` | before adding an endpoint |
| `docs/design/07-frontend-architecture.md` | before writing a component (8 ADRs) |
