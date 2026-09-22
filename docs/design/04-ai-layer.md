# PRAHARI — AI Layer Design

**Version** 1.0 · **Date** 2026-09-22 · **SDK** `google-genai` (Python)

---

## 1. The governing constraint

> ## ⭐ The AI never produces a number.
>
> Gemini has exactly three jobs: **read documents**, **narrate computed results**, and **route questions to deterministic engines**. Every numeric claim that reaches a user is computed by L2–L4 and verified by a programmatic grounding check before rendering.

**Why this is the central design decision:** the failure mode that would most damage this product's credibility is a hallucinated figure — a casualty count, a rupee amount, a building total — presented to a District Collector as authoritative. Most hackathon projects mitigate this with prompt instructions. We make it **structurally impossible** by validating output against the computed payload and falling back to a deterministic template on violation.

It is also the clearest answer to "is the AI doing meaningful work": the AI is doing work only an LLM can do (multimodal document understanding, multilingual register-appropriate drafting), and provably not doing work it would do badly (arithmetic, physics, optimisation).

---

## 2. The three jobs

| Job | Why an LLM is the right tool | Why nothing else is |
|---|---|---|
| **J1 — Bulletin extraction** | IMD publishes authoritative cyclone bulletins as **PDF/HTML text with no JSON API**. Layout varies. Multimodal understanding handles it. | Regex/template parsing breaks on format drift. Document AI Custom Extractor needs a labelled training set we don't have. |
| **J2 — Advisory narration** | Output must read like an official Indian administrative instruction, in **English and Odia**, at the right register for a District Collector. | Templates can't handle the combinatorial variety of hazard × role × stage × language without becoming unreadable. |
| **J3 — Analyst query** | Free-form questions over computed results ("which shelters in Puri are compromised and how many people do they serve?") | A fixed dashboard can't anticipate every question a reviewer or official will ask. |

---

## 3. J1 — IMD bulletin → structured track

### Contract

```python
class ExtractedField(BaseModel):
    value: float | str | None
    confidence: Literal["high", "medium", "low"]
    source_text: str | None      # ⭐ the verbatim span it came from

class BulletinExtraction(BaseModel):
    bulletin_id: ExtractedField
    issued_at: ExtractedField
    system_name: ExtractedField
    classification: ExtractedField        # "Very Severe Cyclonic Storm" etc.
    warning_stage: ExtractedField         # maps to IMD's 4 stages
    current_lat: ExtractedField
    current_lon: ExtractedField
    max_wind_kt: ExtractedField
    central_pressure_mb: ExtractedField
    expected_landfall_at: ExtractedField
    expected_landfall_location: ExtractedField
    forecast_surge_m: ExtractedField      # IMD publishes this directly
    districts_warned: list[ExtractedField]
    extraction_warnings: list[str]
```

```python
response = client.models.generate_content(
    model=settings.gemini_model_extract,          # pinned, never "-latest"
    contents=[EXTRACT_PROMPT, pdf_part],
    config=types.GenerateContentConfig(
        response_mime_type="application/json",     # ⭐ both required —
        response_schema=BulletinExtraction,        #    mime type alone is a soft hint
        temperature=0.0,
    ),
)
extraction = response.parsed
```

### Design rules

1. **`source_text` on every field.** The verbatim span it was read from. This makes extraction auditable — a reviewer can check the claim against the document without re-reading it. It also makes hallucinated fields obvious: no span, no trust.
2. **`confidence: low` ⇒ never silently used.** Low-confidence fields route to a review queue and are excluded from the hazard computation, which records a `DataFreshnessWarning`.
3. **Temperature 0.0.** Extraction is not a creative task.
4. **Cross-validation against IBTrACS.** When the storm exists in IBTrACS, extracted lat/lon/wind are compared to the best-track record; a divergence beyond tolerance raises a warning rather than being accepted.
5. **IMD's own `forecast_surge_m` is captured and displayed alongside ours.** ⭐ This is a deliberate honesty feature: if IMD says 3.0–4.5 m for Fani and our heuristic says something else, **we show both.** That comparison is more credible than hiding it, and it positions us correctly — we consume IMD's authority, we don't compete with it.

### Prompt structure (`prompts/extract_bulletin.v1.txt`)

```
ROLE: You extract structured data from India Meteorological Department cyclone bulletins.

RULES
- Extract ONLY what is explicitly stated. Never infer, never estimate, never fill gaps.
- If a field is absent or illegible: value=null, confidence="low".
- source_text must be the verbatim span. If you cannot quote it, the field is null.
- Preserve IMD's own units; do not convert.
- Bulletins use "Very Severe Cyclonic Storm" style classifications — copy them exactly.

OUTPUT: JSON conforming to the provided schema. No prose.
```

---

## 4. J2 — Computed results → official advisory

### The pipeline

```
ExposureSummary + DecisionPacket + SurgeEstimate
        │
        ▼
  build_grounding_set()          ⭐ every number the model is allowed to use
        │
        ▼
  Gemini (temp 0.2, schema-constrained)
        │
        ▼
  validate_grounding()           ⭐ every number in output must be in the set
        │
   ┌────┴────┐
   ▼         ▼
  pass    fail → one repair attempt (violations named)
   │              │
   │         ┌────┴────┐
   │         ▼         ▼
   │       pass     fail → deterministic template
   ▼         ▼               ▼
        render + log eval datapoint
```

### The grounding set

```python
class GroundingSet(BaseModel):
    """The complete set of numeric facts the narrator may reference."""
    facts: dict[str, GroundedFact]      # canonical_name → value + unit + source

    def contains(self, n: float, tol: float = 0.01) -> bool:
        return any(abs(n - f.value) <= tol * max(1.0, abs(f.value))
                   for f in self.facts.values())

def build_grounding_set(exposure, decisions, surge, track) -> GroundingSet:
    return GroundingSet(facts={
        "population_at_risk":    GroundedFact(exposure.population_at_risk, "people", "L3"),
        "buildings_at_risk":     GroundedFact(exposure.buildings_at_risk, "buildings", "L3"),
        "shelters_total":        GroundedFact(exposure.shelters_total, "shelters", "L3"),
        "shelters_compromised":  GroundedFact(exposure.shelters_compromised, "shelters", "L3"),
        "hospitals_at_risk":     GroundedFact(exposure.hospitals_at_risk, "hospitals", "L3"),
        "road_km_affected":      GroundedFact(exposure.road_km_affected, "km", "L3"),
        "peak_surge_m":          GroundedFact(surge.peak_surge_m, "m", "L2-heuristic"),
        "hours_to_landfall":     GroundedFact(track.hours_to_landfall, "h", "L2"),
        "max_wind_ms":           GroundedFact(track.max_wind_ms, "m/s", "L2"),
        "unassigned_population": GroundedFact(decisions.unassigned, "people", "L4"),
        ...
    })
```

### The validator

```python
NUMERIC = re.compile(r"(?<![\w.])(?:₹\s?)?(\d[\d,]*(?:\.\d+)?)\s*(?:lakh|crore|km|m|%)?")

def validate_grounding(text: str, allowed: GroundingSet) -> GroundingReport:
    found, ungrounded = [], []
    for m in NUMERIC.finditer(text):
        n = float(m.group(1).replace(",", ""))
        found.append(n)
        if not allowed.contains(n) and n not in ALLOWED_INCIDENTALS:
            ungrounded.append({"value": n, "span": m.group(0)})
    return GroundingReport(ok=not ungrounded, found=found, ungrounded=ungrounded)

# dates, stage hours (72/48/24/12), and list ordinals are legitimate
ALLOWED_INCIDENTALS = {72, 48, 24, 12, *range(1, 32), *range(1900, 2100)}
```

> ⚠️ **Known limitation, stated honestly:** the validator catches *numeric* hallucination, not qualitative overclaim ("catastrophic", "certain"). Qualitative control is handled by prompt constraints plus a banned-phrase lint — a weaker guarantee, and [05-evals.md](05-evals.md) measures it separately rather than assuming it works.

### Advisory response schema

```python
class Advisory(BaseModel):
    role: Role                     # COLLECTOR | SRC | POWER_UTILITY | NDRF | FINANCE
    stage: IMDStage
    language: Literal["en", "or"]
    headline: str = Field(max_length=140)
    situation: str                 # what the model says is happening
    actions: list[ActionItem]      # each with deadline + responsible office
    caveats: list[str]             # ⭐ injected, not generated
    grounding: GroundingReport     # ⭐ shipped with the advisory
    generated_by: GenerationMethod # GEMINI | GEMINI_REPAIRED | TEMPLATE_FALLBACK
```

⭐ **`generated_by` is surfaced in the UI.** Anyone reviewing an advisory can see whether it was LLM-written or fell back to a template. That transparency is worth more than a uniformly polished output.

### Prompt structure (`prompts/narrate_advisory.v1.txt`)

```
ROLE: You draft cyclone response advisories for Indian district administration.

ABSOLUTE CONSTRAINTS
- Use ONLY the numbers in GROUNDED_FACTS. Never compute, estimate, round or invent
  a number. If a number you want is not in GROUNDED_FACTS, describe it qualitatively
  or omit it.
- Never state or imply casualties, deaths, or injuries. This system forecasts asset
  and infrastructure impact only.
- Never claim certainty. Forecasts are probabilistic.
- Address the named role. Use the register of Indian official administrative
  correspondence: direct, imperative, specific about office and deadline.
- Every action item needs a responsible office and a clock deadline.

CONTEXT
  Role: {role} | IMD stage: {stage} | Hours to landfall: {hours}
  GROUNDED_FACTS: {facts_json}
  COMPROMISED_SHELTERS: {shelter_list}
  UNREACHABLE_POPULATION: {unassigned}

OUTPUT: JSON per schema. Language: {language}.
```

> **On Odia output:** Gemini's Odia quality is unbenchmarked for this register. Mitigation — generate English first, then translate as a **separate schema-constrained call with the grounding set re-validated post-translation** (numbers survive translation; a mistranslated number is a grounding failure and gets caught). A translation that fails grounding falls back to English with a visible notice.

---

## 5. J3 — Analyst query via function calling

Raw Gemini function calling ([ADR-009](02-architecture.md#adr-009--raw-gemini-function-calling-over-adk)) — no framework. The LLM **selects tools and composes answers; the engines compute.**

```python
TOOLS = [
    query_exposure,          # (admin_unit, asset_type?) → ExposureSummary
    list_compromised_shelters,  # (district) → named shelters inside surge zone
    get_shelter_assignment,  # (village) → assigned shelter + travel time
    get_parametric_status,   # (zone) → trigger state + payout
    compare_to_observed,     # (run_id) → CSI/IoU vs SAR truth
    explain_limitations,     # () → the limitations block
]
```

**Rules**
- Tools return **typed models, never free text** — so J3 output is grounded by construction
- `explain_limitations` exists so "how accurate is this?" is answered from the record, not improvised
- Tool results flow through the same grounding validator before rendering
- Hard cap of 5 tool-call rounds; exceeded ⇒ return partial answer + note

---

## 6. Model & quota policy

```python
class AISettings(BaseSettings):
    gemini_model_extract:  str  # pinned Flash-tier ID
    gemini_model_narrate:  str
    gemini_model_query:    str
    max_retries: int = 2
    timeout_s: float = 30.0
    enable_ai: bool = True      # ⭐ kill switch → full template fallback
```

| Rule | Reason |
|---|---|
| **Flash-tier only, never Pro** | Pro was removed from the free tier on 1 Apr 2026 |
| **Pin explicit model IDs; never `-latest`** | A silent model change mid-competition is unacceptable |
| **Enable billing day 1** | Free quotas were cut 50–80% in Dec 2025 (2.5 Flash reportedly ~250/day → as low as ~20/day). Flash pricing makes a demo day cost a few dollars |
| **Verify live limits at `aistudio.google.com/rate-limit`** | The published numbers are volatile |
| **`enable_ai=False` kill switch** | If Gemini is down or rate-limited during judging, the product still works entirely on templates |
| **Log every call** to `ai_calls` | Feeds evals and gives an audit trail |

### Cost envelope (order of magnitude)
Extraction ≈ 1 call per bulletin. Narration ≈ (5 roles × 4 stages × 2 languages) = 40 calls per scenario worst case, in practice ~12 for the demo path. At Flash pricing this is cents per scenario. **Cost is not a design constraint; quota is.**

---

## 7. Failure modes and responses

| Failure | Detection | Response |
|---|---|---|
| Ungrounded number | Grounding validator | Repair once → template fallback |
| Schema violation | Pydantic parse failure | Retry with error appended → template |
| Low-confidence extraction | `confidence == "low"` | Exclude field, warn, route to review |
| Extraction contradicts IBTrACS | Cross-validation | Warn, prefer IBTrACS, surface both |
| Gemini 429 | HTTP status | Exponential backoff → template |
| Gemini unreachable | Timeout | Template, `generated_by=TEMPLATE_FALLBACK` |
| Odia translation loses a number | Post-translation grounding | English + visible notice |
| Prompt injection via bulletin PDF | Extraction schema constrains output shape | Model can only emit schema fields; no tool access in J1 |

> ⭐ **Prompt injection deserves explicit mention:** J1 ingests an external document. It runs with **no tools, a strict output schema, and temperature 0** — so a malicious instruction embedded in a PDF can at worst produce wrong field values, which cross-validation against IBTrACS then catches. J1 can never trigger an action.

---

## 8. Why the AI layer is defensible

| Signal | Evidence |
|---|---|
| **Multimodal understanding on a real document** | IMD bulletins are genuinely unparsed by any existing tool; there is no JSON API |
| **Structured output done properly** | Schema-constrained, per-field confidence, verbatim source spans |
| **A real, measured guardrail** | The grounding validator is instrumented, and its pass rate is an eval metric ([05-evals.md](05-evals.md)) — not an unverified claim |
| **Honest division of labour** | Physics in numpy, optimisation in OR-Tools, language in Gemini. Each tool does what it's good at |
| **Graceful degradation** | The product works with AI disabled — which is what "deployable" actually means |
| **Multilingual with verification** | Odia output whose numbers are re-validated after translation |

**The defensible one-line claim:** *"Gemini reads India's authoritative cyclone bulletins, which no existing tool parses, and drafts role-specific bilingual advisories in which every single number is programmatically proven to come from our deterministic models."*
