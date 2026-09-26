"""ScenarioService: request -> content-addressed run -> background pipeline.

Runs are content-addressed by params_hash (the request minus cosmetic
fields, plus code and config versions). A repeat request is a cache hit and
never recomputes: that is what makes the precomputed demo runs instant.

Compute runs on a background thread for now.
TODO(backend): move to a Cloud Run Job enqueued via Cloud Tasks.
"""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from functools import lru_cache

from prahari import __version__
from prahari.ai.client import AIClient, get_ai_client
from prahari.api.errors import (
    InvalidTrackSourceError,
    PrahariError,
    QuotaExceededError,
    TrackKindUnsupportedError,
    TruthUnavailableError,
)
from prahari.config.regions import AUTO_AOI, NO_SAR_TRUTH
from prahari.config.settings import get_settings
from prahari.ingestion.layers import EarthEngineLayers, LayerSource
from prahari.models.scenario import RunStatus, ScenarioRequest, TrackSource
from prahari.models.track import CycloneTrack
from prahari.storage.runs import RunMeta, RunStore
from prahari.workers.scenario import PipelineInputs, check_modellable, load_track, run_pipeline

ESTIMATED_SECONDS = 150  # measured: ~70 s pipeline + ~55 s Gemini narration
# Each run is ~90 s of Earth Engine work; cap it so request floods cannot
# drain the EE quota. Beyond the cap the API answers 429 + Retry-After.
MAX_CONCURRENT_RUNS = 1


def params_hash(req: ScenarioRequest) -> str:
    """Content address used as the cache key. Cosmetic fields are excluded."""
    payload = {
        "request": req.model_dump(mode="json", exclude={"label"}),
        "code_version": __version__,
        "config_version": get_settings().config_version,
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


class ScenarioService:
    def __init__(
        self,
        store: RunStore | None = None,
        layers_factory: Callable[[], LayerSource] = EarthEngineLayers,
        track_loader: Callable[[str, int | None], CycloneTrack] = load_track,
        ai: AIClient | None = None,
    ) -> None:
        self.store = store or RunStore()
        self.layers_factory = layers_factory
        self.track_loader = track_loader
        self.ai = ai
        self._lock = threading.Lock()
        self._inflight: dict[str, str] = {}  # params_hash -> run_id

    @staticmethod
    def check(req: ScenarioRequest) -> None:
        if req.track.kind != "ibtracs":
            raise TrackKindUnsupportedError(
                f"track kind {req.track.kind!r} is not ingested yet (GDACS feeds and IMD "
                "bulletins are the next ingestion step); use 'ibtracs'."
            )
        if not req.track.storm_name:
            raise InvalidTrackSourceError("track.storm_name is required for an IBTrACS track.")
        if req.run_validation and req.track.storm_name.upper() in NO_SAR_TRUTH:
            raise TruthUnavailableError(
                f"{req.track.storm_name} has no usable post-landfall Sentinel-1 "
                "imagery. A validation score cannot be fabricated."
            )

    def check_track(self, req: ScenarioRequest) -> None:
        """A landfall-derived AOI needs a modellable track: refuse it with the exact
        problem (no landfall, outside coverage, too short) before queueing compute."""
        if req.aoi_preset != AUTO_AOI:
            return
        track = self.track_loader(req.track.storm_name or "", req.track.season)
        check_modellable(track)

    def create(self, req: ScenarioRequest) -> tuple[RunMeta, bool]:
        """Return (run, cache_hit). Starts a background run on a miss."""
        self.check(req)
        self.check_track(req)
        phash = params_hash(req)
        done = self.store.find_complete(phash)
        if done is not None:
            return done, True
        with self._lock:
            running = self._inflight.get(phash)
            if running is not None:
                meta = self.store.meta(running)
                if meta is not None:
                    return meta, False
            if len(self._inflight) >= MAX_CONCURRENT_RUNS:
                raise QuotaExceededError(
                    "A scenario is already computing. Retry shortly, or open a precomputed run."
                )
            meta = self._new_meta(req, phash)
            self._inflight[phash] = meta.run_id
        threading.Thread(target=self._execute, args=(meta.run_id,), daemon=True).start()
        return meta, False

    def run_sync(
        self, storm: str, season: int, aoi: str, validate: bool, alias: str | None = None
    ) -> RunMeta:
        req = ScenarioRequest(
            track=TrackSource(kind="ibtracs", storm_name=storm, season=season),
            aoi_preset=aoi,
            run_validation=validate,
            languages=["en", "or"],
            label=alias,
        )
        self.check(req)
        self.check_track(req)
        meta = self._new_meta(req, params_hash(req), alias)
        self._execute(meta.run_id)
        return self.store.meta(meta.run_id) or meta

    def _new_meta(self, req: ScenarioRequest, phash: str, alias: str | None = None) -> RunMeta:
        settings = get_settings()
        meta = RunMeta(
            run_id=str(uuid.uuid4()),
            status=RunStatus.QUEUED,
            params_hash=phash,
            request=req.model_dump(mode="json"),
            code_version=__version__,
            config_version=settings.config_version,
            created_at=datetime.now(UTC),
            alias=alias,
        )
        self.store.save_meta(meta)
        return meta

    def _execute(self, run_id: str) -> None:
        meta = self.store.meta(run_id)
        if meta is None:
            return
        req = ScenarioRequest.model_validate(meta.request)
        meta.status = RunStatus.RUNNING
        self.store.save_meta(meta)

        def on_stage(stage: str) -> None:
            meta.stages_complete.append(stage)
            self.store.save_meta(meta)

        try:
            track = self.track_loader(req.track.storm_name or "", req.track.season)
            inputs = PipelineInputs(
                track=track,
                aoi=req.aoi_preset,
                surge_level_m=req.hazard.surge_level_m,
                funnel_amplification=req.hazard.funnel_amplification,
                holland_b_override=req.hazard.holland_b_override,
                dem_offset_m=req.hazard.dem_offset_m,
                run_validation=req.run_validation,
                generate_advisories=req.generate_advisories,
                languages=tuple(req.languages),
            )
            ai = self.ai or get_ai_client()
            result, layers = run_pipeline(inputs, self.layers_factory(), run_id, on_stage, ai)
            self.store.save_result(run_id, result, layers)
            meta.status = RunStatus.COMPLETE
            meta.warnings = result.warnings
        except PrahariError as exc:
            meta.status = RunStatus.FAILED
            meta.error = f"{exc.slug}: {exc.detail or exc.title}"
        except Exception as exc:  # the science failed: record it loudly, never degrade
            meta.status = RunStatus.FAILED
            meta.error = f"hazard-model-error: {type(exc).__name__}: {exc}"
        finally:
            meta.completed_at = datetime.now(UTC)
            self.store.save_meta(meta)
            with self._lock:
                if self._inflight.get(meta.params_hash) == run_id:
                    del self._inflight[meta.params_hash]


@lru_cache
def get_scenario_service() -> ScenarioService:
    return ScenarioService()
