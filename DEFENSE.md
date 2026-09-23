# PRAHARI: defending the design

Likely judge questions, with answers that point at the code. Numbers quoted
here come from the stored Fani run (`data/runs/`, alias `fani-2019-puri`).

---

### 1. "Is this real, or a mock-up?"
It is the engine's output. `python -m prahari.workers.scenario --storm FANI
--season 2019 --aoi puri_khordha --validate` runs the whole pipeline on live
Earth Engine data:

1. The IBTrACS track.
2. The Holland wind field.
3. Surge and inundation on Copernicus GLO-30.
4. WorldPop 2019 population and Open Buildings v3.
5. The 877-shelter OSDMA register.
6. OR-Tools assignment.
7. The parametric trigger.
8. Sentinel-1 validation.
9. Gemini narration.

The UI reads only the API (`web/src/features/scenario/useScenario.tsx`). The
hand-written fixtures were deleted this build; `grep -r fixtures web/src`
returns nothing.

### 2. "Why a heuristic surge index instead of a real surge model?"
No published Bay-of-Bengal wind-to-surge formula exists. The operational
literature (the Dube/Rao/Sinha line, Johns 1985, Flather 1994) is dynamical
shallow-water modelling, not a plug-in equation. So `hazard/surge.py` is an
explicitly labelled index:
- `model_class` is the Literal `"heuristic_index"`.
- `calibration` is always `None`.
- The UI shows a HEURISTIC badge on every depth.

The product's value is the translation from hazard to orders. The surge module
can be swapped for an ADCIRC or IMD product behind the same `SurgeEstimate`.

### 3. "Why bathtub inundation? It over-floods."
Naive thresholding floods disconnected inland basins. We flood-fill from the
open sea instead (`hazard/inundation.py: connected_inundation`), so the
connected area is always a subset of the naive one. That is a tested invariant,
and the API reports both figures (782 vs 853 km² for Fani).

Enclosed lagoons are split off by a morphological opening (`split_water`) and
act as barriers. Chilika's narrow inlet throttles surge, so treating it as open
sea would flood its whole shoreline.

### 4. "Your validation CSI is 0.001. Doesn't that mean the model is wrong?"
For Fani's surge extent, yes: we report exactly that.

We did not tune the model to Sentinel-1. The evidence screen says "below the
0.25 floor", and the extent never earns a "validated" badge: `validated_against`
stays `None` in `workers/scenario.py`.

We checked the truth pipeline before blaming the model:
- **Registration.** Pre-event Sentinel-1 water matches JRC permanent water with
  an IoU of 0.73, and that is best at zero shift; any one-cell shift is worse.
  So the masks are aligned.
- **Geometry.** Pre and post images share one relative orbit (48), so
  look-angle differences cannot read as flood.
- **Sensitivity.** CSI stays at 0.000–0.001 for every surge level from 1.6 to
  3.6 m. The model and the observed flood are in different places, not
  mis-scaled.

Where they differ:
- The model floods the low coastal plain.
- Sentinel-1, 18 h after landfall, saw water inland along the Puri river plains.
  That is consistent with rain and river flooding, which a surge model does not
  simulate.

The failure analysis in the API names those places. `05-evals.md` treats both
CSI > 0.70 and near-zero CSI as bug signals rather than wins.

### 5. "Where does the AI actually matter, and how do you stop it inventing numbers?"
Gemini writes each stage briefing, in English and in Odia (Odia is a separate,
re-validated translation).

It never produces a number (`ai/grounding.py`):
- Every number in its text must be one of the numbers in that stage's prompt.
- Integers must match exactly. Decimals may be rounded to 1–2 places, never to
  an integer.
- Stage hours are accepted only in time phrases such as "T-48h".
- A claim lint rejects "has been issued", "communicated to" and casualty words.

On a failure, Gemini gets one repair attempt that names the bad numbers. If
that also fails, the briefing falls back to a deterministic template.
`generated_by` (GEMINI, GEMINI_REPAIRED or TEMPLATE_FALLBACK) and the count of
numbers checked are shown on screen. `tests/unit/test_ai.py` proves that a
hallucinated number is rejected and that the template is used.

### 5b. "Can I ask it something?"
Yes: use **Ask this run** on the Map screen (`POST /api/v1/query`, `ai/query.py`).
- Gemini function-calls 8 read-only tools over the stored run, such as `list_compromised_shelters(block)`, `get_validation()` and `explain_limitations()`.
- It is capped at 5 rounds.
- Its answer must use only numbers the tools returned. If it doesn't, the engine output is shown instead.
- The tools it called are listed under the answer.
- The endpoint is rate-limited (12 questions a minute, HTTP 429 beyond that), because each question is a live model call.

### 6. "What if Gemini or Earth Engine is down during the demo?"
- The demo runs are precomputed and stored, so opening one is a cache hit with
  no external call.
- `/api/v1/healthz` reports `degraded`, never an error.
- `ENABLE_AI=false` switches every briefing to templates.
- An AI failure returns HTTP 200 with a template. A hazard failure returns 500
  and is never retried. We serve a worse sentence, never a wrong number
  (`api/errors.py`).

### 7. "How is shelter assignment computed? Is it just nearest-shelter?"
It uses OR-Tools min-cost flow (`decision/assignment.py`):
- Flood clusters are sources, shelters outside the flood are sinks, and there is
  a penalised "unassigned" arc.
- It maximises people sheltered first, then minimises person-km.
- A greedy nearest-first baseline runs on the same arcs, and both are reported.
  For Fani, the optimiser places more people with fewer person-km.
- Compromised shelters get no arcs.
- Every unassigned cluster carries a machine-readable reason.

### 8. "Why doesn't the frontend talk to Cloud Run directly? Where's CORS?"
There is no CORS by design. Firebase Hosting rewrites `/api/**` to the Cloud
Run service (`firebase.json`), and Vite's proxy mirrors that rewrite in dev.
The browser sees one origin.

### 9. "Where do the shelter names come from? Could you be inventing places?"
Every name comes from the committed OSDMA register (`data/raw/osdma_shelters.csv`).
Its columns are shifted: the real block is in the `village` column. The single
loader `ingestion/shelters.py` corrects that. Flood clusters are named "Near
<nearest register shelter>". A test asserts that every shelter name on screen
matches the register.

### 10. "Shelter capacity? OSDMA doesn't publish it."
Correct. Capacity is imputed from shelter type (`CAPACITY_BY_TYPE`), flagged
`capacity_imputed`, and marked * in the table. The disclosure says so.

### 11. "The parametric trigger fired in every zone. Is that meaningful?"
It uses the PCRIC dual-trigger pattern: each zone pays the larger of a wind tier
and a flooded-population tier. Fani was an extremely severe cyclone, and its
modelled wind crossed the 33 m/s tier across the whole area, so every zone
triggers.

The thresholds and limits are labelled `illustrative_not_actuarial` in the type
system (`basis` is a Literal). We demonstrate the mechanism and the evidence
trail, not an actuarial product.

### 12. "Does it scale beyond Puri?"
- A new coast is config, not code: an AOI preset plus a funnel key in
  `config/regions.py`.
- Yaas (Balasore/Bhadrak) runs on the same code; its run is precomputed too.
- Each run is one content-addressed job (`params_hash`), so N districts are N
  parallel jobs.
- Compute is capped at one concurrent run per instance (HTTP 429 beyond that),
  to protect the Earth Engine quota.

### 13. "What's not built?"
- Road network routing: we use straight line × 1.3, stated in the disclosure.
- Hospitals and power assets.
- GDACS live feeds and IMD bulletin PDF ingestion. The API returns 400 for
  those track kinds rather than faking them.
- Deployment to Cloud Run and Firebase: the config and script are ready in
  `deploy/deploy.ps1`, but deploying needs billing approval.

### 14. "How do you know the numbers didn't change between the pipeline and the screen?"
- The frontend types are generated from the backend's OpenAPI schema
  (`npm run api:check`).
- The adapter only renames fields (`web/tests/adapter.test.ts` checks that
  headline numbers pass through unchanged).
- Every modelled value carries the server's own `limitations` list into its
  badge.

### 15. "Why should a District Collector trust this?"
Because it tells them when not to:
- Every modelled number carries its disclosure.
- The validation failure is on screen, not hidden.
- Capacity, reachability and plinth assumptions are spelled out above the
  shelter table.
- Orders are recommendations with evidence attached, recorded in the order
  ledger when the official ticks them.
