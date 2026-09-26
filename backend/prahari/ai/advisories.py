"""J2: computed results -> a Collector's stage briefing, in English and Odia.

Pipeline per (stage, language), 04-ai-layer.md §4:
    grounding set -> Gemini (schema-constrained) -> validate
      pass -> GEMINI
      fail -> one repair naming the bad numbers -> GEMINI_REPAIRED
      fail -> deterministic template -> TEMPLATE_FALLBACK
Odia is a separate translation of the grounded English text, re-validated;
a translation that loses a number falls back to English with a notice.

Caveats are injected from ModelDisclosure, never generated. Action items are
referenced by id from the deterministic packet, never rewritten.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Literal

from pydantic import BaseModel, Field

from prahari.ai.client import AIClient
from prahari.ai.grounding import GroundingSet, scaled_numbers, validate
from prahari.models.results import (
    STAGE_HOURS,
    AdvisoriesResponse,
    Advisory,
    GroundingReport,
    IMDStage,
    RunResult,
)

PROMPT_VERSION = "narrate_advisory.v2"
IST_OFFSET = timedelta(hours=5, minutes=30)
Language = Literal["en", "or"]
GeneratedBy = Literal["GEMINI", "GEMINI_REPAIRED", "TEMPLATE_FALLBACK"]

STAGE_NAMES: dict[IMDStage, str] = {
    "PRE_CYCLONE_WATCH": "Pre-Cyclone Watch",
    "CYCLONE_ALERT": "Cyclone Alert",
    "CYCLONE_WARNING": "Cyclone Warning",
    "POST_LANDFALL": "Post-Landfall Outlook",
}

SYSTEM = """You draft cyclone response briefings for Indian district administration.

ABSOLUTE CONSTRAINTS
- Use ONLY the numbers in GROUNDED_FACTS, written exactly as given. Never compute,
  estimate, round, add or invent a number. If a number you want is not in
  GROUNDED_FACTS, describe it qualitatively or leave it out.
- Never state or imply casualties, deaths or injuries. This system forecasts
  asset and infrastructure impact only.
- Never claim certainty. The flood extent is a heuristic model output.
- Never say an order was issued, sent or communicated: these are recommendations
  for the Collector to issue. Write numbers as digits, never as words.
- Register: Indian official administrative correspondence. Direct and specific.
- headline: one line, at most 120 characters. situation: 2 to 3 sentences.
"""

TRANSLATE_SYSTEM = """Translate the JSON fields into Odia (ଓଡ଼ିଆ) for a District Collector.
Keep every number exactly as written, in Western digits. Keep shelter names,
register ids and office names as they are. Do not add or remove any fact."""


class AdvisoryDraft(BaseModel):
    headline: str = Field(max_length=160)
    situation: str = Field(max_length=900)


def _facts_for_prompt(run: RunResult, stage: IMDStage) -> dict[str, object]:
    s = run.summary
    orders = [a for a in run.decisions.actions if a.stage == stage]
    facts: dict[str, object] = {
        "storm": f"{s.storm_name.title()} {s.season}",
        "season": s.season,
        "area": s.aoi,
        "stage": STAGE_NAMES[stage],
        "hours_before_landfall": STAGE_HOURS[stage],
        "peak_surge_m (heuristic index)": s.peak_surge_m,
        "area_flooded_km2": s.area_flooded_km2,
        "population_at_risk": s.population_at_risk,
        "buildings_at_risk": s.buildings_at_risk,
    }
    if _has_register(run):
        facts |= {
            "shelters_compromised": s.shelters_compromised,
            "shelters_total": s.shelters_total,
            "people_without_a_shelter_place": s.unassigned_population,
            "max_estimated_road_distance_km (straight line x 1.3, no road network)": 10,
        }
    else:
        facts["shelter_register"] = "none for this region: no shelter figures exist"
    return facts | {
        "orders_this_stage_count": len(orders),
        "orders_this_stage": [
            {"office": a.office, "order": a.title, "people": a.people} for a in orders[:8]
        ],
    }


# Prompt fields that are context, not quotable counts: a year or a stage hour
# must never pass as "2019 families" or "48 shelters".
_CONTEXT_FIELDS = {"storm", "season", "stage", "hours_before_landfall", "area"}


def _numbers(value: object) -> list[float]:
    if isinstance(value, bool):
        return []
    if isinstance(value, int | float):
        return [float(value)]
    if isinstance(value, str):
        return [v for _, v in scaled_numbers(value)]
    if isinstance(value, dict):
        return [n for v in value.values() for n in _numbers(v)]
    if isinstance(value, list):
        return [n for v in value for n in _numbers(v)]
    return []


def grounding_set(run: RunResult, stage: IMDStage) -> GroundingSet:
    """Exactly the numbers the prompt for this stage contained: the model may
    use what it was given and nothing else. The storm label and area name are
    context, exempt from the number check but never countable."""
    prompt = _facts_for_prompt(run, stage)
    quotable = {k: v for k, v in prompt.items() if k not in _CONTEXT_FIELDS}
    facts = _numbers(quotable)
    s = run.summary
    return GroundingSet(
        facts={f"f{i}": v for i, v in enumerate(facts)},
        context=[f"{s.storm_name.title()} {s.season}", s.aoi],
        dates=_run_dates(run),
        times=_run_times(run),
    )


def _run_dates(run: RunResult) -> list[str]:
    """Landfall and stage-deadline dates, in UTC and IST."""
    moments = [a.deadline for a in run.decisions.actions]
    if run.summary.landfall_at:
        moments.append(run.summary.landfall_at)
    out = set()
    for m in moments:
        out.add(m.date().isoformat())
        out.add((m + IST_OFFSET).date().isoformat())
    return sorted(out)


def _run_times(run: RunResult) -> list[str]:
    moments = [a.deadline for a in run.decisions.actions]
    if run.summary.landfall_at:
        moments.append(run.summary.landfall_at)
    return sorted({f"{(m + d):%H:%M}" for m in moments for d in (IST_OFFSET, timedelta(0))})


def _has_register(run: RunResult) -> bool:
    coverage = run.summary.coverage
    return coverage is None or coverage.shelters != "none"


def template(run: RunResult, stage: IMDStage) -> AdvisoryDraft:
    s = run.summary
    n = sum(1 for a in run.decisions.actions if a.stage == stage)
    if not _has_register(run):
        return AdvisoryDraft(
            headline=f"{STAGE_NAMES[stage]}: {s.population_at_risk:,} people in the modelled flood",
            situation=(
                f"The model floods {s.area_flooded_km2} km2 of {s.aoi} with "
                f"{s.population_at_risk:,} people and {s.buildings_at_risk:,} buildings inside "
                "it. No shelter register covers this region, so no shelter figures exist. "
                f"{n} orders are due at this stage."
            ),
        )
    return AdvisoryDraft(
        headline=(
            f"{STAGE_NAMES[stage]}: {s.shelters_compromised} shelters in the modelled surge zone"
        ),
        situation=(
            f"The model floods {s.area_flooded_km2} km2 of {s.aoi} with "
            f"{s.population_at_risk:,} people and {s.buildings_at_risk:,} buildings inside it. "
            f"{s.unassigned_population:,} people have no cyclone-shelter place within 10 km. "
            f"{n} orders are due at this stage."
        ),
    )


def _draft(
    ai: AIClient, model: str, run: RunResult, stage: IMDStage, allowed: GroundingSet
) -> tuple[AdvisoryDraft, GeneratedBy, GroundingReport]:
    facts = json.dumps(_facts_for_prompt(run, stage), ensure_ascii=False)
    prompt = f"GROUNDED_FACTS: {facts}\n\nWrite the briefing JSON in English."
    draft = ai.generate_json(model, SYSTEM, prompt, AdvisoryDraft)
    if draft is not None:
        report = validate(f"{draft.headline} {draft.situation}", allowed)
        if report.ok:
            return draft, "GEMINI", report
        repair = (
            f"{prompt}\n\nYour previous draft used numbers that are NOT in GROUNDED_FACTS: "
            f"{', '.join(report.ungrounded)}. Rewrite it using only numbers from GROUNDED_FACTS."
        )
        fixed = ai.generate_json(model, SYSTEM, repair, AdvisoryDraft)
        if fixed is not None:
            report = validate(f"{fixed.headline} {fixed.situation}", allowed)
            if report.ok:
                return fixed, "GEMINI_REPAIRED", report
    fallback = template(run, stage)
    return (
        fallback,
        "TEMPLATE_FALLBACK",
        validate(f"{fallback.headline} {fallback.situation}", allowed),
    )


def build_advisories(run: RunResult, ai: AIClient, languages: list[Language]) -> AdvisoriesResponse:
    model = ai.settings.gemini_model_narrate
    caveats = run.summary.disclosure.limitations[:3]
    out: list[Advisory] = []
    for stage in STAGE_HOURS:
        allowed = grounding_set(run, stage)
        english, method, report = _draft(ai, model, run, stage, allowed)
        action_ids = [a.subject_id for a in run.decisions.actions if a.stage == stage]
        used_model = model if method != "TEMPLATE_FALLBACK" else None
        if "en" in languages:
            out.append(
                Advisory(
                    stage=stage,
                    language="en",
                    headline=english.headline,
                    situation=english.situation,
                    action_ids=action_ids,
                    caveats=caveats,
                    generated_by=method,
                    grounding=report,
                    model_id=used_model,
                    prompt_version=PROMPT_VERSION,
                )
            )
        if "or" in languages:
            translated = None
            if ai.available:
                translated = ai.generate_json(
                    model, TRANSLATE_SYSTEM, english.model_dump_json(), AdvisoryDraft
                )
            odia_report = (
                validate(f"{translated.headline} {translated.situation}", allowed)
                if translated
                else None
            )
            if translated is not None and odia_report is not None and odia_report.ok:
                out.append(
                    Advisory(
                        stage=stage,
                        language="or",
                        headline=translated.headline,
                        situation=translated.situation,
                        action_ids=action_ids,
                        caveats=caveats,
                        generated_by=method,
                        grounding=odia_report,
                        model_id=model,
                        prompt_version=PROMPT_VERSION,
                    )
                )
            else:
                out.append(
                    Advisory(
                        stage=stage,
                        language="or",
                        headline=english.headline,
                        situation=english.situation,
                        action_ids=action_ids,
                        caveats=caveats,
                        generated_by="TEMPLATE_FALLBACK" if translated is None else method,
                        grounding=report,
                        model_id=None,
                        prompt_version=PROMPT_VERSION,
                        notice="Odia translation unavailable or failed number checks; "
                        "showing English.",
                    )
                )
    return AdvisoriesResponse(advisories=out)
