"""File-backed run store.

A run lives at data/runs/<run_id>/ as run.json (the RunResult), meta.json
(request, params_hash, versions, status) and layers/<name>.png. Precomputed
demo runs are just runs that are already on disk, so the demo is a cache hit
with no Earth Engine or Gemini call in the request path.

TODO(backend): swap for GCS + Postgres behind the same interface on Cloud Run.
"""

from __future__ import annotations

import shutil
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from prahari.config.paths import DATA_DIR
from prahari.models.results import RunResult

RUNS_DIR = DATA_DIR / "runs"


class RunMeta(BaseModel):
    run_id: str
    status: str
    params_hash: str
    request: dict[str, Any]
    code_version: str
    config_version: str
    created_at: datetime
    completed_at: datetime | None = None
    stages_complete: list[str] = []
    warnings: list[str] = []
    error: str | None = None
    alias: str | None = None  # human slug for precomputed demo runs


class RunStore:
    def __init__(self, root: Path = RUNS_DIR) -> None:
        self.root = root
        self._lock = threading.RLock()
        self._results: dict[str, RunResult] = {}
        self._metas: dict[str, RunMeta] = {}

    def _dir(self, run_id: str) -> Path:
        if not run_id.replace("-", "").isalnum():
            raise ValueError("invalid run id")
        return self.root / run_id

    def save_meta(self, meta: RunMeta) -> None:
        with self._lock:
            self._metas[meta.run_id] = meta.model_copy(deep=True)
            d = self._dir(meta.run_id)
            d.mkdir(parents=True, exist_ok=True)
            _atomic_write(d / "meta.json", meta.model_dump_json(indent=2))

    def save_result(self, run_id: str, result: RunResult, layers: dict[str, bytes]) -> None:
        d = self._dir(run_id)
        (d / "layers").mkdir(parents=True, exist_ok=True)
        for name, png in layers.items():
            (d / "layers" / f"{name}.png").write_bytes(png)
        with self._lock:
            _atomic_write(d / "run.json", result.model_dump_json())
            self._results[run_id] = result

    def metas(self) -> list[RunMeta]:
        """Every run on disk, including ones written by another process (the CLI)."""
        if self.root.exists():
            for f in self.root.glob("*/meta.json"):
                if f.parent.name not in self._metas:
                    self.meta(f.parent.name)
        with self._lock:
            return [m.model_copy(deep=True) for m in self._metas.values()]

    def meta(self, run_id: str) -> RunMeta | None:
        with self._lock:
            cached = self._metas.get(run_id)
            if cached is not None:
                return cached.model_copy(deep=True)
            try:
                f = self._dir(run_id) / "meta.json"
            except ValueError:
                return None
            if not f.exists():
                return None
            try:
                meta = RunMeta.model_validate_json(f.read_text(encoding="utf-8"))
            except ValueError:
                return None
            self._metas[run_id] = meta
            return meta.model_copy(deep=True)

    def resolve(self, key: str) -> RunMeta | None:
        """A run id or a precomputed alias such as 'fani-2019-puri'."""
        direct = self.meta(key)
        if direct is not None:
            return direct
        return next((m for m in self.metas() if m.alias == key), None)

    def result(self, run_id: str) -> RunResult | None:
        with self._lock:
            cached = self._results.get(run_id)
        if cached is not None:
            return cached
        f = self._dir(run_id) / "run.json"
        if not f.exists():
            return None
        result = RunResult.model_validate_json(f.read_text(encoding="utf-8"))
        with self._lock:
            self._results[run_id] = result
        return result

    def layer(self, run_id: str, name: str) -> bytes | None:
        if not name.replace("_", "").isalnum():
            return None
        f = self._dir(run_id) / "layers" / f"{name}.png"
        return f.read_bytes() if f.exists() else None

    def delete(self, run_id: str) -> bool:
        d = self._dir(run_id)
        with self._lock:
            self._results.pop(run_id, None)
            self._metas.pop(run_id, None)
            if not d.exists():
                return False
            shutil.rmtree(d)
            return True

    def find_complete(self, params_hash: str) -> RunMeta | None:
        return next(
            (m for m in self.metas() if m.params_hash == params_hash and m.status == "COMPLETE"),
            None,
        )


def _atomic_write(target: Path, text: str) -> None:
    """Write-then-rename. Windows refuses the rename while a reader holds the
    target open, so retry briefly rather than fail the run."""
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")
    for attempt in range(20):
        try:
            tmp.replace(target)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.05)
