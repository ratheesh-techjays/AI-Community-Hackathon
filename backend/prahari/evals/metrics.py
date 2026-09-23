"""Hazard skill metrics against observed SAR flood extent.

CSI == Threat Score == IoU/Jaccard for binary masks. They are NUMERICALLY
IDENTICAL -- report ONE and say which. Reporting all three is padding.

Honest expectation for a parametric bathtub model: CSI 0.30-0.50.
Calibrated hydrodynamic models reach 0.60-0.80. A score above
``CSI_CEILING_WARNING`` is treated as a BUG SIGNAL (mask leakage, unmasked
permanent water), not a win.
"""

from __future__ import annotations

import numpy as np
from pydantic import BaseModel

CSI_FLOOR = 0.25
CSI_EXPECTED: tuple[float, float] = (0.30, 0.50)
CSI_CEILING_WARNING = 0.70
CSI_DEGENERATE = 0.05  # masks barely overlap: check the truth pipeline first


class HazardSkill(BaseModel):
    hits: int
    misses: int
    false_alarms: int
    csi: float  # = Threat Score = IoU
    pod: float  # probability of detection
    far: float  # false alarm ratio
    bias: float  # > 1 over-predicts extent
    suspicious: bool  # above ceiling -> investigate before celebrating
    degenerate: bool  # near zero -> investigate before blaming the model

    @property
    def passes_floor(self) -> bool:
        return self.csi >= CSI_FLOOR


def hazard_skill(
    predicted: np.ndarray,
    observed: np.ndarray,
    valid: np.ndarray | None = None,
) -> HazardSkill:
    """Confusion-matrix skill scores for two binary masks."""
    if predicted.shape != observed.shape:
        raise ValueError(f"shape mismatch: {predicted.shape} vs {observed.shape}")
    if valid is None:
        valid = np.ones(predicted.shape, dtype=bool)

    pred = predicted[valid].astype(bool)
    obs = observed[valid].astype(bool)

    hits = int((pred & obs).sum())
    misses = int((~pred & obs).sum())
    false_alarms = int((pred & ~obs).sum())

    denom = hits + misses + false_alarms
    csi = hits / denom if denom else 0.0
    observed_total = hits + misses
    predicted_total = hits + false_alarms

    return HazardSkill(
        hits=hits,
        misses=misses,
        false_alarms=false_alarms,
        csi=csi,
        pod=hits / observed_total if observed_total else 0.0,
        far=false_alarms / predicted_total if predicted_total else 0.0,
        bias=predicted_total / observed_total if observed_total else 0.0,
        suspicious=csi > CSI_CEILING_WARNING,
        degenerate=denom > 0 and csi < CSI_DEGENERATE,
    )
