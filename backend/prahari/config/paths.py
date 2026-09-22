"""Filesystem paths, resolved once.

Data lives at the REPO ROOT (shared with the frontend and notebooks), not
inside the backend package.

    <repo>/backend/prahari/config/paths.py
    parents[0]=config  [1]=prahari  [2]=backend  [3]=<repo root>
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(os.environ.get("PRAHARI_REPO_ROOT", Path(__file__).resolve().parents[3]))

DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
GOLDEN_DIR = DATA_DIR / "golden"
FIXTURES_DIR = DATA_DIR / "fixtures"

IBTRACS_CSV = RAW_DIR / "ibtracs_NI.csv"
OSDMA_SHELTERS_CSV = RAW_DIR / "osdma_shelters.csv"
OSDMA_SHELTERS_GEOJSON = RAW_DIR / "osdma_shelters.geojson"
