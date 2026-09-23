"""J3: analyst questions over a run, by Gemini function calling (04-ai-layer.md §5).

Raw function calling, no framework (ADR-009). Gemini chooses which tools to
call and composes the answer; the tools read the stored engine output and
compute nothing new. The answer then goes through the same grounding
validator as the briefings, with the tool outputs as its allowed numbers. A
failure falls back to a plain rendering of what the tools returned.

`tool_calls` is returned so the UI can show exactly what was looked up.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any, Literal

from pydantic import BaseModel, Field

from prahari.ai.client import AIClient
from prahari.ai.grounding import GroundingSet, scaled_numbers, validate
from prahari.evals.metrics import CSI_FLOOR
from prahari.models.results import GroundingReport, RunResult

MAX_ROUNDS = 5
MAX_ROWS = 15

SYSTEM = """You answer questions from Indian district officials about ONE modelled
cyclone scenario. Call the tools to look facts up; never answer from memory.

RULES
- Every number in your answer must appear in a tool result, written the same way.
  Never compute, sum, round or estimate a new number.
- Never state or imply casualties. Never say an order was issued or sent.
- Any rupee figure is illustrative: always say "illustrative" with it.
- The flood extent is a heuristic model; say so if asked how reliable it is
  (call explain_limitations or get_validation).
- Answer in 2 to 4 sentences, plainly. Name shelters and blocks exactly as the
  tools return them.
- Lists are ranked and may be truncated: use sort_by for "most people", and if
  "truncated" is true say the list shows the top entries of "total".
- The engine DOES generate recommended orders per stage: call list_orders for them.
  Never say something is not modelled unless explain_limitations says so.
- No one is assigned to a compromised shelter; its figure is the people whose
  nearest shelter it is, redirected elsewhere. Distances are estimates
  (straight line x 1.3), not road routes."""


class QueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    run_id: str = Field(min_length=1, max_length=80)
    language: Literal["en", "or"] = "en"


class ToolCallRecord(BaseModel):
    name: str
    args: dict[str, Any]
    rows: int


class QueryResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]
    grounding: GroundingReport
    generated_by: Literal["GEMINI", "TEMPLATE_FALLBACK"]
    rounds_used: int


def _page(rows: list[dict[str, Any]], order: str) -> dict[str, Any]:
    """A ranked list that says when it is cut, so the model cannot mistake the
    first page for the whole."""
    return {
        "total": len(rows),
        "shown": min(len(rows), MAX_ROWS),
        "truncated": len(rows) > MAX_ROWS,
        "order": order,
        "rows": rows[:MAX_ROWS],
    }


def _match(value: str | None, wanted: str | None) -> bool:
    return not wanted or (value or "").upper() == wanted.strip().upper()


def tools_for(run: RunResult) -> dict[str, tuple[Callable[..., Any], dict[str, Any], str]]:
    """name -> (function, JSON schema of args, description). Pure reads of `run`."""

    def run_summary() -> dict[str, Any]:
        return run.summary.model_dump(mode="json", exclude={"disclosure"})

    def list_compromised_shelters(
        block: str | None = None, district: str | None = None, sort_by: str = "depth"
    ) -> dict[str, Any]:
        rows = [
            s
            for s in run.assets.shelters
            if s.status == "compromised" and _match(s.block, block) and _match(s.district, district)
        ]
        key = (
            (lambda s: -s.displaced_people)
            if sort_by == "people"
            else (lambda s: -(s.depth_m or 0))
        )
        ranked = sorted(rows, key=key)
        return _page(
            [
                {
                    "rank": i + 1,
                    "register_id": s.register_id,
                    "name": s.name,
                    "block": s.block,
                    "district": s.district,
                    "depth_m": s.depth_m,
                    # Nobody is assigned to a compromised shelter: these are the
                    # people whose NEAREST shelter it is, redirected elsewhere.
                    "people_whose_nearest_shelter_this_is": s.displaced_people,
                    "redirect_them_to": s.reassign_to_name,
                }
                for i, s in enumerate(ranked)
            ],
            f"sorted by {'people' if sort_by == 'people' else 'depth'}, largest first",
        )

    def block_exposure(block: str) -> list[dict[str, Any]]:
        return [b.model_dump() for b in run.exposure.rows if _match(b.block, block)]

    def list_blocks() -> list[dict[str, Any]]:
        return [
            {"block": b.block, "district": b.district, "population_at_risk": b.population_at_risk}
            for b in run.exposure.rows
            if b.population_at_risk > 0
        ][: MAX_ROWS * 2]

    def list_unassigned(block: str | None = None) -> dict[str, Any]:
        return _page(
            [
                {
                    "rank": i + 1,
                    "near": u.near,
                    "block": u.block,
                    "people": u.people,
                    "reason": u.reason,
                }
                for i, u in enumerate(u for u in run.decisions.unassigned if _match(u.block, block))
            ],
            "sorted by people, largest first",
        )

    def parametric_status(zone: str | None = None) -> list[dict[str, Any]]:
        return [
            {
                "zone": z.zone_name,
                "triggered": z.triggered,
                "payout_crore_illustrative": round(z.payout_inr / 1e7, 1),
                "peak_wind_ms": z.trigger_a_wind.value,
                "flooded_population_share": z.trigger_b_population_index.value,
            }
            for z in run.parametric.zones
            if _match(z.zone_name, zone)
        ][:MAX_ROWS]

    def list_orders(stage: str | None = None, office: str | None = None) -> dict[str, Any]:
        wanted = (stage or "").upper()
        rows = [
            {
                "rank": i + 1,
                "stage": a.stage,
                "office": a.office,
                "order": a.title,
                "people": a.people,
                "deadline_utc": a.deadline.isoformat(),
            }
            for i, a in enumerate(
                a
                for a in run.decisions.actions
                if (not wanted or a.stage == wanted)
                and (not office or office.lower() in a.office.lower())
            )
        ]
        return _page(rows, "in deadline order")

    def get_validation() -> dict[str, Any]:
        v = run.validation
        if not v.available or v.skill is None:
            return {"available": False, "reason": v.reason_unavailable}
        s = v.skill
        return {
            "available": True,
            "csi": s.csi,
            "pod": s.pod,
            "far": s.far,
            "expected_range": list(s.expected_range),
            "passed_floor": s.csi >= CSI_FLOOR,
            "failure_analysis": s.failure_analysis,
        }

    def explain_limitations() -> dict[str, list[str]]:
        return {
            "hazard": run.hazard.disclosure.limitations,
            "decisions": run.decisions.disclosure.limitations,
            "parametric": run.parametric.disclosure.limitations,
        }

    s_opt = {"type": "string"}
    return {
        "run_summary": (
            run_summary,
            {"type": "object", "properties": {}},
            "Headline numbers of the run.",
        ),
        "list_compromised_shelters": (
            list_compromised_shelters,
            {
                "type": "object",
                "properties": {
                    "block": s_opt,
                    "district": s_opt,
                    "sort_by": {"type": "string", "enum": ["depth", "people"]},
                },
            },
            "Register shelters inside the modelled flood, deepest first; "
            "optional block/district filter.",
        ),
        "block_exposure": (
            block_exposure,
            {"type": "object", "properties": {"block": s_opt}, "required": ["block"]},
            "People, buildings, depth and compromised shelters for one block.",
        ),
        "list_blocks": (
            list_blocks,
            {"type": "object", "properties": {}},
            "Blocks with people at risk.",
        ),
        "list_unassigned": (
            list_unassigned,
            {"type": "object", "properties": {"block": s_opt}},
            "Flood clusters with no shelter place, largest first, with the reason.",
        ),
        "parametric_status": (
            parametric_status,
            {"type": "object", "properties": {"zone": s_opt}},
            "Parametric trigger state per block zone (illustrative payouts).",
        ),
        "list_orders": (
            list_orders,
            {
                "type": "object",
                "properties": {
                    "stage": {
                        "type": "string",
                        "enum": [
                            "PRE_CYCLONE_WATCH",
                            "CYCLONE_ALERT",
                            "CYCLONE_WARNING",
                            "POST_LANDFALL",
                        ],
                    },
                    "office": s_opt,
                },
            },
            "The recommended orders the engine generated, per IMD stage and office.",
        ),
        "get_validation": (
            get_validation,
            {"type": "object", "properties": {}},
            "Satellite validation score.",
        ),
        "explain_limitations": (
            explain_limitations,
            {"type": "object", "properties": {}},
            "What the models do not capture.",
        ),
    }


_ID = re.compile(r"(?:OSDMA-\d{4}|C\d{3}-\d{3}|Z-[A-Z]+)")


def _numbers(value: Any) -> list[float]:
    """Numbers in a tool result: JSON numbers as-is, strings with scale words."""
    if isinstance(value, bool) or value is None:
        return []
    if isinstance(value, int | float):
        return [float(value)]
    if isinstance(value, str):
        return [v for _, v in scaled_numbers(_ID.sub(" ", value))]
    if isinstance(value, dict):
        return [n for v in value.values() for n in _numbers(v)]
    if isinstance(value, list):
        return [n for v in value for n in _numbers(v)]
    return []


def _ids(value: Any) -> list[str]:
    """Real register / cluster / zone ids a tool returned: exempt context."""
    return sorted(set(_ID.findall(json.dumps(value))))


def _fallback(records: list[tuple[str, Any]]) -> str:
    if not records:
        return "The AI assistant is unavailable. Open the tables on the Map and Shelters screens."
    parts = []
    for name, result in records:
        if isinstance(result, dict) and "rows" in result:
            result = result["rows"]
        rows = result if isinstance(result, list) else [result]
        shown = [
            ", ".join(f"{k}: {v}" for k, v in row.items() if not isinstance(v, list | dict))
            for row in rows[:3]
            if isinstance(row, dict)
        ]
        parts.append(f"{name} returned {len(rows)} row(s): " + " | ".join(shown))
    return (
        "Gemini's answer failed the number or claims check, so it is not shown. "
        "This is the raw engine output it looked up, not an answer: " + " || ".join(parts)
    )


def answer(run: RunResult, req: QueryRequest, ai: AIClient) -> QueryResponse:
    from google.genai import types

    registry = tools_for(run)
    tool = types.Tool(
        function_declarations=[
            types.FunctionDeclaration(name=n, description=d, parameters_json_schema=schema)
            for n, (_, schema, d) in registry.items()
        ]
    )
    language = "Answer in Odia (ଓଡ଼ିଆ), numbers in Western digits." if req.language == "or" else ""
    contents: list[Any] = [
        types.Content(role="user", parts=[types.Part.from_text(text=f"{req.question}\n{language}")])
    ]
    records: list[tuple[str, Any]] = []
    calls: list[ToolCallRecord] = []
    rounds = 0
    text: str | None = None
    while rounds < MAX_ROUNDS:
        rounds += 1
        response = ai.chat(ai.settings.gemini_model_query, SYSTEM, contents, [tool])
        if response is None:
            break
        function_calls = response.function_calls or []
        if not function_calls:
            text = response.text
            break
        contents.append(response.candidates[0].content)
        parts = []
        for fc in function_calls:
            fn = registry.get(fc.name or "")
            args = dict(fc.args or {})
            try:
                result: Any = fn[0](**args) if fn else {"error": f"unknown tool {fc.name}"}
            except TypeError as exc:
                result = {"error": f"bad arguments: {exc}"}
            records.append((fc.name or "?", result))
            calls.append(
                ToolCallRecord(
                    name=fc.name or "?",
                    args=args,
                    rows=(
                        len(result["rows"])
                        if isinstance(result, dict) and "rows" in result
                        else len(result)
                        if isinstance(result, list)
                        else 1
                    ),
                )
            )
            parts.append(
                types.Part.from_function_response(name=fc.name or "?", response={"result": result})
            )
        contents.append(types.Content(role="user", parts=parts))

    looked_up = [r for _, r in records]
    allowed = GroundingSet(
        facts={
            f"t{i}": n
            for i, n in enumerate(
                [n for r in looked_up for n in _numbers(r)]
                + [float(len(r)) for r in looked_up if isinstance(r, list)]
                + [float(len(r["rows"])) for r in looked_up if isinstance(r, dict) and "rows" in r]
            )
        },
        context=[
            f"{run.summary.storm_name.title()} {run.summary.season}",
            run.summary.aoi,
            *_ids(looked_up),
        ],
    )
    if text:
        report = validate(text, allowed)
        if report.ok:
            return QueryResponse(
                answer=text.strip(),
                tool_calls=calls,
                grounding=report,
                generated_by="GEMINI",
                rounds_used=rounds,
            )
    fallback = _fallback(records)
    return QueryResponse(
        answer=fallback,
        tool_calls=calls,
        grounding=validate(fallback, allowed),
        generated_by="TEMPLATE_FALLBACK",
        rounds_used=rounds,
    )
