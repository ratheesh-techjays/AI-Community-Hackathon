"""AI safety: Gemini never gets a number past the grounding validator."""

from __future__ import annotations

from typing import Any, TypeVar

import pytest
from pydantic import BaseModel

from prahari.ai.advisories import AdvisoryDraft, build_advisories, grounding_set
from prahari.ai.grounding import GroundingSet, validate
from prahari.config.settings import Settings
from prahari.models.results import RunResult
from prahari.workers.scenario import PipelineInputs, run_pipeline
from tests.synthetic import SyntheticLayers, synthetic_track

T = TypeVar("T", bound=BaseModel)


class ScriptedAI:
    """Returns queued drafts in order; None when the queue is empty."""

    def __init__(self, drafts: list[AdvisoryDraft | None]) -> None:
        self.settings = Settings(gemini_api_key="test", enable_ai=True)
        self.drafts = list(drafts)
        self.calls = 0

    @property
    def available(self) -> bool:
        return True

    def generate_json(self, model: str, system: str, prompt: str, schema: type[T]) -> T | None:
        self.calls += 1
        draft = self.drafts.pop(0) if self.drafts else None
        return schema.model_validate(draft.model_dump()) if draft is not None else None

    def chat(self, *args: Any, **kwargs: Any) -> None:
        return None


@pytest.fixture(scope="module")
def run() -> RunResult:
    inputs = PipelineInputs(track=synthetic_track(), aoi="puri_khordha", surge_level_m=2.0)
    return run_pipeline(inputs, SyntheticLayers(), "ai-test")[0]


def _grounded(run: RunResult) -> AdvisoryDraft:
    s = run.summary
    return AdvisoryDraft(
        headline=f"{s.shelters_compromised} shelters sit in the modelled surge zone",
        situation=f"{s.population_at_risk:,} people live in modelled flood cells.",
    )


HALLUCINATED = AdvisoryDraft(headline="Expect 12,345 houses destroyed", situation="Severe.")


def test_validator_rejects_an_invented_count() -> None:
    allowed = GroundingSet(facts={"shelters": 29.0, "people": 120483.0})
    assert validate("29 shelters and 1,20,483 people", allowed).ok
    assert not validate("29 shelters and 1,20,000 people", allowed).ok
    report = validate("31 shelters and 5 hospitals", allowed)
    assert not report.ok
    assert set(report.ungrounded) == {"31", "5"}


def test_validator_reads_odia_digits() -> None:
    allowed = GroundingSet(facts={"shelters": 29.0})
    assert validate("୨୯ ଆଶ୍ରୟସ୍ଥଳୀ", allowed).ok
    assert not validate("୩୧ ଆଶ୍ରୟସ୍ଥଳୀ", allowed).ok


def test_real_ids_dates_and_stage_hours_are_context_not_claims() -> None:
    allowed = GroundingSet(
        facts={}, context=["OSDMA-0123", "C022-018"], dates=["2019-05-03"], times=["06:00"]
    )
    text = "OSDMA-0123 near C022-018 by 06:00 on 3 May 2019, T-48h"
    assert validate(text, allowed).ok
    # A date or time the run does not have is not exempt.
    assert not validate("Landfall on 14 June 2019 at 23:59 IST", allowed).ok
    # An id the caller did not name is a number like any other.
    assert not validate("OSDMA-0999 is open", allowed).ok


def test_grounded_draft_is_used_as_gemini(run: RunResult) -> None:
    ai = ScriptedAI([_grounded(run)] * 4)
    out = build_advisories(run, ai, ["en"])  # type: ignore[arg-type]
    assert {a.generated_by for a in out.advisories} == {"GEMINI"}
    assert all(a.grounding.ok for a in out.advisories)


def test_hallucination_is_repaired_once(run: RunResult) -> None:
    ai = ScriptedAI([HALLUCINATED, _grounded(run)] * 4)
    out = build_advisories(run, ai, ["en"])  # type: ignore[arg-type]
    assert {a.generated_by for a in out.advisories} == {"GEMINI_REPAIRED"}


def test_persistent_hallucination_falls_back_to_the_template(run: RunResult) -> None:
    ai = ScriptedAI([HALLUCINATED] * 8)
    out = build_advisories(run, ai, ["en"])  # type: ignore[arg-type]
    assert {a.generated_by for a in out.advisories} == {"TEMPLATE_FALLBACK"}
    assert all("12,345" not in a.headline for a in out.advisories)
    assert all(a.grounding.ok for a in out.advisories), "the template itself must be grounded"


def test_no_ai_means_templates_everywhere(run: RunResult) -> None:
    ai = ScriptedAI([])
    out = build_advisories(run, ai, ["en", "or"])  # type: ignore[arg-type]
    assert {a.generated_by for a in out.advisories} == {"TEMPLATE_FALLBACK"}
    odia = [a for a in out.advisories if a.language == "or"]
    assert odia and all(a.notice for a in odia)


def test_odia_translation_that_loses_a_number_falls_back_to_english(run: RunResult) -> None:
    good = _grounded(run)
    bad_translation = AdvisoryDraft(headline="୯୯୯ ଆଶ୍ରୟସ୍ଥଳୀ", situation="ଭୁଲ")
    ai = ScriptedAI([good, bad_translation] * 4)
    out = build_advisories(run, ai, ["en", "or"])  # type: ignore[arg-type]
    for a in (a for a in out.advisories if a.language == "or"):
        assert a.headline == good.headline
        assert a.notice


def test_every_advisory_carries_grounding_and_injected_caveats(run: RunResult) -> None:
    """C5."""
    out = build_advisories(run, ScriptedAI([]), ["en"])  # type: ignore[arg-type]
    for a in out.advisories:
        assert a.generated_by in {"GEMINI", "GEMINI_REPAIRED", "TEMPLATE_FALLBACK"}
        assert a.caveats == run.summary.disclosure.limitations[:3]
        assert a.grounding is not None


def test_grounding_set_is_exactly_the_prompt_numbers(run: RunResult) -> None:
    facts = set(grounding_set(run, "CYCLONE_ALERT").facts.values())
    assert run.summary.population_at_risk in facts
    assert run.summary.shelters_compromised in facts
    # Per-block counts were never in the prompt, so the narrator may not use them.
    prompt_free = {
        float(b.population_at_risk) for b in run.exposure.rows if b.population_at_risk > 0
    } - facts
    assert prompt_free, "fixture should have block counts that are not prompt facts"
    assert not any(grounding_set(run, "CYCLONE_ALERT").contains(n) for n in prompt_free)


@pytest.mark.parametrize(
    "text",
    [
        "Evacuate 2000 people now",  # a year-shaped count
        "24 shelters have collapsed",  # a stage-hour-shaped count
        "3 m surge expected",  # 2.63 rounded to an integer
        "1 shelter lost",
    ],
)
def test_reviewer_bypasses_are_now_rejected(text: str) -> None:
    allowed = GroundingSet(facts={"surge": 2.63, "people": 470801.0}, context=["Fani 2019"])
    assert not validate(text, allowed).ok


@pytest.mark.parametrize(
    "text",
    [
        "2019 families must move.",  # the season is context, not a count
        "48 shelters need inspection.",  # a stage hour is not a count
        "Deploy 57 Marine police teams.",  # month-prefix word
        "Mayurbhanj 88 shelters are open.",
        "Release INR5000000 now (illustrative).",  # number glued to letters
        "x9999 people",
        "1234-56-78 households",  # not a real date
        "C999-999 cluster",  # an id nobody named
        "23:59 people",  # a clock value used as a count
        "2.6 lakh people",  # scale word: 260,000 is not a fact
        "Residents were evacuated.",
        "Orders were issued to all BDOs.",
        "Evacuation is complete.",
        "People may drown.",
        "Many will perish.",
        "Lives will be lost.",
        "The surge will certainly reach 2.63 m.",
        "Release INR 1,537.5 crore now.",  # money without 'illustrative'
    ],
)
def test_round3_bypasses_are_rejected(text: str) -> None:
    allowed = GroundingSet(
        facts={"surge": 2.63, "people": 470801.0, "payout": 1.5375e10}, context=["Fani 2019"]
    )
    assert not validate(text, allowed).ok, text


def test_scaled_money_with_qualifier_passes() -> None:
    allowed = GroundingSet(facts={"payout": 1.5375e10})
    assert validate("Release INR 1,537.5 crore (illustrative).", allowed).ok


def test_odia_claims_are_checked() -> None:
    assert not validate("୨୯ ଜଣଙ୍କ ମୃତ୍ୟୁ", GroundingSet(facts={"n": 29.0})).ok


def test_stage_hours_pass_only_as_time_phrases() -> None:
    allowed = GroundingSet(facts={})
    assert validate("Complete by T-48h, within 24 hours and 72.0 hours before landfall", allowed).ok
    assert not validate("24 shelters flood", allowed).ok


@pytest.mark.parametrize(
    "text",
    [
        "Instructions have been communicated to every BDO.",
        "The evacuation order has been issued.",
        "No casualties are expected.",
    ],
)
def test_claims_the_system_never_made_are_rejected(text: str) -> None:
    report = validate(text, GroundingSet(facts={}))
    assert not report.ok
    assert report.banned


@pytest.mark.parametrize(
    "text",
    [
        "5000people must move",  # glued to a word
        "surge of 6m",
        "300km of coast",
        "winds of 250kmph",
        "29 ଲକ୍ଷ ଲୋକ",  # Odia lakh
        "29 लाख लोग",  # Hindi lakh
        "29 hundred houses",
        "29 billion rupees (illustrative)",
        "Landfall on 14 June 2019 at 23:59 IST",
        "Lives were lost in the surge.",
        "Many lost their lives.",
        "A fatal surge is coming.",
        "The Collector has issued the order.",
        "Evacuation of 29 people is complete.",
        "People evacuated safely.",
        "ପ୍ରାଣହାନି ହୋଇପାରେ",
        "Release $241 now.",  # money without the qualifier
        "ଟଙ୍କା 29 ଦିଆଯିବ",
    ],
)
def test_round4_bypasses_are_rejected(text: str) -> None:
    allowed = GroundingSet(facts={"shelters": 29.0, "total": 241.0}, dates=["2019-05-03"])
    assert not validate(text, allowed).ok, text


def test_odia_hours_are_a_time_phrase() -> None:
    assert validate("ସ୍ଥଳଭାଗ ଛୁଇଁବାର 72.0 ଘଣ୍ଟା ପୂର୍ବରୁ", GroundingSet(facts={})).ok


def test_stored_style_briefing_still_passes(run: RunResult) -> None:
    """The hardening must not reject a legitimate, grounded briefing."""
    s = run.summary
    text = (
        f"At 48.0 hours before landfall, the heuristic model floods {s.area_flooded_km2} km2 "
        f"of {s.aoi}, with {s.population_at_risk} people and {s.buildings_at_risk} buildings "
        f"inside it; {s.shelters_compromised} of {s.shelters_total} shelters are compromised."
    )
    assert validate(text, grounding_set(run, "CYCLONE_ALERT")).ok


@pytest.mark.parametrize(
    "text",
    [
        "29 lac people",
        "15 mn residents",
        "15M residents",
        "A 2.6-lakh population",
        "A 10-15 m surge is expected",
        "10 to 15 people per shelter",
        "Many people will lose their lives",
        "Loss of lives is expected",
        "People may be swept away",
        "NDRF teams have been positioned",
        "Residents were ordered evacuated",
        "Evacuation is over",
        "Absolutely safe",
        "Undoubtedly the worst",
        "Pay Rs29 now",
        "Pay £29 (illustrative)",  # £ is money: fine only because illustrative -> tested below
        "INR 29 crore (this is not illustrative)",
        "3 May 2099",
        "29 shelters flood, resulting in 241 people without a place",
        "ଲୋକ ମରିବେ",
        "लोग मारे जाएंगे",
    ],
)
def test_round5_bypasses_are_rejected(text: str) -> None:
    allowed = GroundingSet(
        facts={"n": 29.0, "t": 241.0, "k": 10.0, "f": 15.0, "s": 2.63}, dates=["2019-05-03"]
    )
    if text.startswith("Pay £29 (illustrative)"):
        assert validate(text, allowed).ok  # money with the qualifier is allowed
    else:
        assert not validate(text, allowed).ok, text


R7 = GroundingSet(facts={"n": 29.0, "a": 782.2, "k": 10.0}, context=["Fani 2019"])


@pytest.mark.parametrize(
    "text",
    [
        "Thirty shelters flood",  # a wrong count written as a word
        "half a million people",
        "Loss of life is possible",
        "People may not survive",
        "Mortality risk is high",
        "They may lose their homes and possibly their lives",
        "Orders have gone out",
        "People have already evacuated",
        "Residents have been moved to safety",
        "The operation has concluded",
        "Shelters are in place",
        "The order went out",
        "Evacuation is now fully complete",
        "It will flood for sure",
        "Between 10 and 18 km",
        "has    been   completed",
    ],
)
def test_round7_plausible_phrasings_are_rejected(text: str) -> None:
    assert not validate(text, R7).ok, text


@pytest.mark.parametrize(
    "text",
    [
        "twenty-nine shelters are in the flood",
        "Cyclone Fani (2019) is severe",
        "In the 2019 season",
        "flooding caused by storm surge",
        "The flood is over 782.2 km2 of land",
        "One of the shelters floods",
        "29 shelters, within 10 km",
    ],
)
def test_round7_legitimate_phrasings_pass(text: str) -> None:
    assert validate(text, R7).ok, text
