"""J3 analyst query: tools read the run; the answer is grounded or replaced."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from prahari.ai.query import QueryRequest, answer, tools_for
from prahari.config.settings import Settings
from prahari.models.results import RunResult
from prahari.workers.scenario import PipelineInputs, run_pipeline
from tests.synthetic import SyntheticLayers, synthetic_track


@dataclass
class FakeCall:
    name: str
    args: dict[str, Any]


@dataclass
class FakeResponse:
    function_calls: list[FakeCall] = field(default_factory=list)
    text: str | None = None

    @property
    def candidates(self) -> list[Any]:
        from google.genai import types

        return [type("C", (), {"content": types.Content(role="model", parts=[])})()]


class ScriptedChat:
    def __init__(self, responses: list[FakeResponse | None]) -> None:
        self.settings = Settings(gemini_api_key="test", enable_ai=True)
        self.responses = list(responses)

    def chat(self, *args: Any, **kwargs: Any) -> FakeResponse | None:
        return self.responses.pop(0) if self.responses else None


@pytest.fixture(scope="module")
def run() -> RunResult:
    inputs = PipelineInputs(track=synthetic_track(), aoi="puri_khordha", surge_level_m=2.0)
    return run_pipeline(inputs, SyntheticLayers(), "query-test")[0]


REQ = QueryRequest(question="Which shelters are compromised?", run_id="query-test")


def test_tools_only_read_the_run(run: RunResult) -> None:
    tools = tools_for(run)
    page = tools["list_compromised_shelters"][0]()
    rows = page["rows"]
    assert rows
    assert page["total"] >= len(rows)
    assert page["truncated"] == (page["total"] > len(rows))
    names = {s.name for s in run.assets.shelters if s.status == "compromised"}
    assert all(r["name"] in names for r in rows)
    assert tools["run_summary"][0]()["population_at_risk"] == run.summary.population_at_risk


def test_grounded_answer_after_a_tool_call(run: RunResult) -> None:
    n = run.summary.shelters_compromised
    ai = ScriptedChat(
        [
            FakeResponse(function_calls=[FakeCall("run_summary", {})]),
            FakeResponse(text=f"{n} shelters are inside the modelled flood."),
        ]
    )
    out = answer(run, REQ, ai)  # type: ignore[arg-type]
    assert out.generated_by == "GEMINI"
    assert [c.name for c in out.tool_calls] == ["run_summary"]
    assert out.grounding.ok


def test_a_hallucinated_number_falls_back_to_engine_output(run: RunResult) -> None:
    ai = ScriptedChat(
        [
            FakeResponse(function_calls=[FakeCall("list_compromised_shelters", {})]),
            FakeResponse(text="987,654 people will be affected."),
        ]
    )
    out = answer(run, REQ, ai)  # type: ignore[arg-type]
    assert out.generated_by == "TEMPLATE_FALLBACK"
    assert "987,654" not in out.answer
    assert "raw engine output it looked up, not an answer" in out.answer
    assert "list_compromised_shelters returned" in out.answer
    assert out.grounding.ok


def test_unknown_tool_is_reported_not_executed(run: RunResult) -> None:
    ai = ScriptedChat([FakeResponse(function_calls=[FakeCall("drop_tables", {})]), None])
    out = answer(run, REQ, ai)  # type: ignore[arg-type]
    assert out.generated_by == "TEMPLATE_FALLBACK"
    assert out.tool_calls[0].name == "drop_tables"


def test_ai_unavailable_says_so(run: RunResult) -> None:
    out = answer(run, REQ, ScriptedChat([]))  # type: ignore[arg-type]
    assert out.generated_by == "TEMPLATE_FALLBACK"
    assert "unavailable" in out.answer


def test_people_ranking_is_by_people_not_depth(run: RunResult) -> None:
    page = tools_for(run)["list_compromised_shelters"][0](sort_by="people")
    people = [r["people_whose_nearest_shelter_this_is"] for r in page["rows"]]
    assert people == sorted(people, reverse=True)
    assert page["order"].startswith("sorted by people")
