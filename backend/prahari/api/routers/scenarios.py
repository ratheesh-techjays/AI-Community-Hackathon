"""Scenario compute and result endpoints.

POST /scenarios is content-addressed: an identical request returns the
existing complete run (cache hit, 200). A new request starts a background
pipeline run (202) that the client polls. A run can be addressed by its
UUID or by a precomputed alias such as `fani-2019-puri`.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response

from prahari.api.auth import require_write_key
from prahari.api.errors import RunNotFoundError
from prahari.api.service import ESTIMATED_SECONDS, ScenarioService, get_scenario_service
from prahari.models.results import (
    AdvisoriesResponse,
    AssetsResponse,
    DecisionsResponse,
    ExposureResponse,
    HazardResponse,
    IMDStage,
    ParametricResponse,
    RunResult,
    ValidationResponse,
)
from prahari.models.scenario import (
    RunStatus,
    ScenarioAccepted,
    ScenarioDetail,
    ScenarioList,
    ScenarioListItem,
    ScenarioRequest,
)
from prahari.storage.runs import RunMeta

router = APIRouter(tags=["scenarios"])
Service = Annotated[ScenarioService, Depends(get_scenario_service)]


def _meta(svc: ScenarioService, key: str) -> RunMeta:
    meta = svc.store.resolve(key)
    if meta is None:
        raise RunNotFoundError(f"no scenario run {key!r}")
    return meta


def _result(svc: ScenarioService, key: str) -> RunResult:
    meta = _meta(svc, key)
    result = svc.store.result(meta.run_id) if meta.status == RunStatus.COMPLETE else None
    if result is None:
        raise RunNotFoundError(f"run {key!r} is {meta.status}; results are not available")
    return result


def _accepted(meta: RunMeta, cache_hit: bool) -> ScenarioAccepted:
    return ScenarioAccepted(
        run_id=meta.run_id,
        status=RunStatus(meta.status),
        params_hash=meta.params_hash,
        cache_hit=cache_hit,
        poll_url=f"/api/v1/scenarios/{meta.run_id}",
        estimated_seconds=None if cache_hit else ESTIMATED_SECONDS,
    )


@router.post(
    "/scenarios",
    response_model=ScenarioAccepted,
    status_code=202,
    dependencies=[Depends(require_write_key)],
)
async def create_scenario(
    req: ScenarioRequest, svc: Service, response: Response
) -> ScenarioAccepted:
    meta, cache_hit = svc.create(req)
    if cache_hit:
        response.status_code = 200
    return _accepted(meta, cache_hit)


@router.get("/scenarios", response_model=ScenarioList)
async def list_scenarios(svc: Service) -> ScenarioList:
    runs = []
    for m in svc.store.metas():
        req = ScenarioRequest.model_validate(m.request)
        runs.append(
            ScenarioListItem(
                run_id=m.run_id,
                alias=m.alias,
                status=RunStatus(m.status),
                label=req.label,
                storm_name=req.track.storm_name,
                season=req.track.season,
                aoi_preset=req.aoi_preset,
                created_at=m.created_at,
            )
        )
    return ScenarioList(runs=sorted(runs, key=lambda r: r.created_at, reverse=True))


@router.get("/scenarios/{run_id}", response_model=ScenarioDetail)
async def get_scenario(run_id: str, svc: Service) -> ScenarioDetail:
    meta = _meta(svc, run_id)
    result = svc.store.result(meta.run_id) if meta.status == RunStatus.COMPLETE else None
    return ScenarioDetail(
        run_id=meta.run_id,
        alias=meta.alias,
        status=RunStatus(meta.status),
        request=ScenarioRequest.model_validate(meta.request),
        params_hash=meta.params_hash,
        code_version=meta.code_version,
        config_version=meta.config_version,
        stages_complete=meta.stages_complete,
        stage_timings_ms=result.stage_timings_ms if result else {},
        warnings=meta.warnings,
        error=meta.error,
        provenance=result.provenance if result else {},
        summary=result.summary if result else None,
        created_at=meta.created_at,
        completed_at=meta.completed_at,
    )


@router.delete("/scenarios/{run_id}", status_code=204, dependencies=[Depends(require_write_key)])
async def delete_scenario(run_id: str, svc: Service) -> Response:
    meta = _meta(svc, run_id)
    svc.store.delete(meta.run_id)
    return Response(status_code=204)


@router.get("/scenarios/{run_id}/hazard", response_model=HazardResponse)
async def get_hazard(run_id: str, svc: Service) -> HazardResponse:
    return _result(svc, run_id).hazard


@router.get("/scenarios/{run_id}/exposure", response_model=ExposureResponse)
async def get_exposure(run_id: str, svc: Service) -> ExposureResponse:
    return _result(svc, run_id).exposure


@router.get("/scenarios/{run_id}/assets", response_model=AssetsResponse)
async def get_assets(run_id: str, svc: Service, compromised_only: bool = False) -> AssetsResponse:
    assets = _result(svc, run_id).assets
    if not compromised_only:
        return assets
    kept = [s for s in assets.shelters if s.status == "compromised"]
    return assets.model_copy(update={"shelters": kept, "count": len(kept)})


@router.get("/scenarios/{run_id}/decisions", response_model=DecisionsResponse)
async def get_decisions(run_id: str, svc: Service) -> DecisionsResponse:
    return _result(svc, run_id).decisions


@router.get("/scenarios/{run_id}/parametric", response_model=ParametricResponse)
async def get_parametric(run_id: str, svc: Service) -> ParametricResponse:
    return _result(svc, run_id).parametric


@router.get("/scenarios/{run_id}/advisories", response_model=AdvisoriesResponse)
async def get_advisories(
    run_id: str,
    svc: Service,
    stage: IMDStage | None = None,
    lang: Literal["en", "or"] | None = None,
) -> AdvisoriesResponse:
    advisories = _result(svc, run_id).advisories
    if advisories is None:
        raise RunNotFoundError(f"run {run_id!r} was computed without advisories")
    kept = [
        a
        for a in advisories.advisories
        if (stage is None or a.stage == stage) and (lang is None or a.language == lang)
    ]
    return AdvisoriesResponse(advisories=kept)


@router.get("/scenarios/{run_id}/validation", response_model=ValidationResponse)
async def get_validation(run_id: str, svc: Service) -> ValidationResponse:
    return _result(svc, run_id).validation


@router.get(
    "/scenarios/{run_id}/layers/{layer}",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
async def get_layer(run_id: str, layer: str, svc: Service) -> Response:
    meta = _meta(svc, run_id)
    png = svc.store.layer(meta.run_id, layer)
    if png is None:
        raise RunNotFoundError(f"run {run_id!r} has no layer {layer!r}")
    # Runs are content-addressed and immutable, so layers cache hard.
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )
