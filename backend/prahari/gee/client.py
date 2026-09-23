"""Earth Engine client: one initialisation, grid-aligned raster fetches.

Every layer is fetched with `computePixels` onto the scenario's GridSpec, so
DEM, population, water and SAR arrays line up cell for cell with the hazard
engine's grid. Nothing here is imported by the hazard engine, which stays
pure and offline-testable.
"""

from __future__ import annotations

import threading
from typing import Any

import numpy as np

from prahari.api.errors import IngestionError
from prahari.config.settings import get_settings
from prahari.models.hazard import GridSpec

_lock = threading.Lock()
_initialised = False


def ensure_initialised() -> Any:
    """Initialise Earth Engine once per process. Returns the `ee` module."""
    global _initialised
    import ee

    with _lock:
        if not _initialised:
            settings = get_settings()
            if not settings.gee_project:
                raise IngestionError("GEE_PROJECT is not set; Earth Engine is unavailable.")
            try:
                if settings.gee_service_account and settings.gee_key_path:
                    credentials = ee.ServiceAccountCredentials(
                        settings.gee_service_account, settings.gee_key_path
                    )
                    ee.Initialize(credentials, project=settings.gee_project)
                else:
                    ee.Initialize(project=settings.gee_project)
            except Exception as exc:
                raise IngestionError(f"Earth Engine initialisation failed: {exc}") from exc
            _initialised = True
    return ee


def fetch_grid(image: Any, grid: GridSpec) -> np.ndarray:
    """Fetch a single-band ee.Image onto `grid` as float64, row 0 = north."""
    ee = ensure_initialised()
    minlon, _, _, maxlat = grid.bbox
    res_x, res_y = grid.resolution_deg
    request = {
        "expression": image.rename("v").toFloat(),
        "fileFormat": "NUMPY_NDARRAY",
        "grid": {
            "dimensions": {"width": grid.width, "height": grid.height},
            "affineTransform": {
                "scaleX": res_x,
                "shearX": 0,
                "translateX": minlon,
                "shearY": 0,
                "scaleY": -res_y,
                "translateY": maxlat,
            },
            "crsCode": grid.crs,
        },
    }
    try:
        result = ee.data.computePixels(request)
    except Exception as exc:
        raise IngestionError(f"Earth Engine fetch failed: {exc}") from exc
    return np.asarray(result["v"], dtype=float)


def get_info(obj: Any) -> Any:
    ensure_initialised()
    try:
        return obj.getInfo()
    except Exception as exc:
        raise IngestionError(f"Earth Engine request failed: {exc}") from exc
