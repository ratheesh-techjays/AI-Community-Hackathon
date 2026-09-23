"""L6 validation: modelled flood extent vs Sentinel-1 observed extent.

Scored on land only: open sea and JRC permanent water are excluded from both
masks, otherwise every model scores well by agreeing that the sea is wet.
The failure analysis is computed from the confusion map, not written by hand.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

import numpy as np

from prahari.evals.metrics import CSI_EXPECTED, hazard_skill
from prahari.ingestion.layers import SarTruth
from prahari.models.results import HazardSkillOut, SensitivityPoint

OBSERVED_FRACTION = 0.5  # a cell counts as observed-flooded if half its pixels are


def confusion(predicted: np.ndarray, observed: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """0 = dry agree/invalid, 1 = hit, 2 = miss, 3 = false alarm."""
    out = np.zeros(predicted.shape, dtype=np.uint8)
    out[valid & predicted & observed] = 1
    out[valid & ~predicted & observed] = 2
    out[valid & predicted & ~observed] = 3
    return out


def score(
    predicted: np.ndarray,
    truth: SarTruth,
    scoring_mask: np.ndarray,
    cell_km2: float,
    block_of_cell: np.ndarray,
    block_names: list[str],
    landfall_at: datetime | None,
    dem_vertical_error_m: float,
) -> tuple[HazardSkillOut, np.ndarray]:
    observed = truth.flooded_fraction >= OBSERVED_FRACTION
    valid = truth.valid & scoring_mask
    skill = hazard_skill(predicted, observed, valid)
    cmap = confusion(predicted, observed, valid)
    return (
        HazardSkillOut(
            csi=round(skill.csi, 3),
            pod=round(skill.pod, 3),
            far=round(skill.far, 3),
            bias=round(skill.bias, 3),
            hits=skill.hits,
            misses=skill.misses,
            false_alarms=skill.false_alarms,
            hits_km2=round(skill.hits * cell_km2, 1),
            misses_km2=round(skill.misses * cell_km2, 1),
            false_alarms_km2=round(skill.false_alarms * cell_km2, 1),
            suspicious=skill.suspicious,
            degenerate=skill.degenerate,
            expected_range=CSI_EXPECTED,
            truth_source=truth.truth_source,
            orbit_pass=truth.orbit_pass,
            pre_dates=truth.pre_dates,
            post_dates=truth.post_dates,
            failure_analysis=failure_analysis(
                cmap,
                cell_km2,
                block_of_cell,
                block_names,
                skill.csi,
                skill.bias,
                truth,
                landfall_at,
                dem_vertical_error_m,
            ),
        ),
        cmap,
    )


def _worst_block(mask: np.ndarray, block_of_cell: np.ndarray, names: list[str]) -> tuple[str, int]:
    ids = block_of_cell[mask & (block_of_cell >= 0)]
    if ids.size == 0:
        return "unlabelled area", 0
    counts = np.bincount(ids, minlength=len(names))
    top = int(counts.argmax())
    return names[top].title(), int(counts[top])


def failure_analysis(
    cmap: np.ndarray,
    cell_km2: float,
    block_of_cell: np.ndarray,
    block_names: list[str],
    csi: float,
    bias: float,
    truth: SarTruth,
    landfall_at: datetime | None,
    dem_vertical_error_m: float,
) -> list[str]:
    notes: list[str] = []
    lo, hi = CSI_EXPECTED
    if csi > 0.70:
        notes.append(
            f"CSI {csi:.2f} is above 0.70: treat as a bug signal (mask leakage or unmasked "
            "permanent water) before reporting it."
        )
    elif csi < 0.05:
        notes.append(
            f"CSI {csi:.3f} is near zero: the predicted and observed masks barely overlap. "
            "Check the truth pipeline (orbit geometry, swath edges, date gap) before "
            "attributing this to the model."
        )
    elif csi < lo:
        notes.append(
            f"CSI {csi:.2f} is below the {lo:.2f}-{hi:.2f} band expected for a parametric "
            "bathtub model; reported as measured, not tuned."
        )
    else:
        notes.append(f"CSI {csi:.2f} is inside the expected {lo:.2f}-{hi:.2f} band.")

    fa_block, fa_cells = _worst_block(cmap == 3, block_of_cell, block_names)
    if fa_cells:
        notes.append(
            f"Largest over-prediction: {fa_block} ({fa_cells * cell_km2:.0f} km2 modelled wet, "
            "observed dry). Static bathtub has no drainage or embankments."
        )
    miss_block, miss_cells = _worst_block(cmap == 2, block_of_cell, block_names)
    if miss_cells:
        notes.append(
            f"Largest miss: {miss_block} ({miss_cells * cell_km2:.0f} km2 observed wet, "
            "modelled dry). A surge-only model cannot represent rain-fed or riverine "
            "flooding; where that is the cause it is out of scope, not a tuning target."
        )
    if bias > 1.2:
        notes.append(f"Bias {bias:.2f}: the model floods more area than was observed.")
    elif 0 < bias < 0.8:
        notes.append(f"Bias {bias:.2f}: the model floods less area than was observed.")
    if landfall_at is not None and truth.post_dates:
        post = datetime.fromisoformat(truth.post_dates[0])
        gap_h = (post - landfall_at.replace(tzinfo=None)).total_seconds() / 3600
        notes.append(
            f"First post-event pass is ~{gap_h:.0f} h after landfall; surge water that drained "
            "before the pass counts as a false alarm."
        )
    notes.append(
        f"DEM vertical error (~{dem_vertical_error_m:.0f} m) is comparable to the surge level "
        "itself; Copernicus GLO-30 is a surface model, so canopy and roofs read high."
    )
    return notes


def sensitivity(
    levels: list[float],
    predict: Callable[[float], np.ndarray],
    truth: SarTruth,
    scoring_mask: np.ndarray,
    cell_km2: float,
) -> list[SensitivityPoint]:
    observed = truth.flooded_fraction >= OBSERVED_FRACTION
    valid = truth.valid & scoring_mask
    out = []
    for level in levels:
        mask = predict(level)
        skill = hazard_skill(mask, observed, valid)
        out.append(
            SensitivityPoint(
                surge_level_m=round(level, 2),
                csi=round(skill.csi, 3),
                area_flooded_km2=round(float(mask.sum()) * cell_km2, 1),
            )
        )
    return out
