"""Evaluation metric tests."""

from __future__ import annotations

import numpy as np
import pytest

from prahari.evals.metrics import (
    CSI_CEILING_WARNING,
    CSI_FLOOR,
    hazard_skill,
)


def test_perfect_prediction_scores_one() -> None:
    mask = np.array([[True, False], [True, True]])
    skill = hazard_skill(mask, mask)
    assert skill.csi == 1.0
    assert skill.pod == 1.0
    assert skill.far == 0.0


def test_perfect_score_is_flagged_suspicious() -> None:
    """A bathtub model beating the ceiling means a bug, not a win."""
    mask = np.ones((4, 4), dtype=bool)
    assert hazard_skill(mask, mask).suspicious is True


def test_realistic_score_is_not_suspicious() -> None:
    observed = np.zeros((10, 10), dtype=bool)
    observed[:5, :] = True
    predicted = np.zeros((10, 10), dtype=bool)
    predicted[2:8, :] = True

    skill = hazard_skill(predicted, observed)
    assert 0.2 < skill.csi < CSI_CEILING_WARNING
    assert skill.suspicious is False


def test_csi_equals_iou() -> None:
    """CSI, Threat Score and IoU are the same number for binary masks."""
    rng = np.random.default_rng(42)
    predicted = rng.random((30, 30)) > 0.5
    observed = rng.random((30, 30)) > 0.5

    skill = hazard_skill(predicted, observed)
    intersection = (predicted & observed).sum()
    union = (predicted | observed).sum()
    assert skill.csi == pytest.approx(intersection / union)


def test_total_miss_scores_zero() -> None:
    observed = np.zeros((6, 6), dtype=bool)
    observed[:3, :] = True
    predicted = np.zeros((6, 6), dtype=bool)
    predicted[3:, :] = True

    skill = hazard_skill(predicted, observed)
    assert skill.csi == 0.0
    assert skill.passes_floor is False


def test_bias_above_one_means_over_prediction() -> None:
    observed = np.zeros((10, 10), dtype=bool)
    observed[:2, :] = True
    predicted = np.zeros((10, 10), dtype=bool)
    predicted[:6, :] = True
    assert hazard_skill(predicted, observed).bias > 1.0


def test_valid_mask_restricts_the_comparison() -> None:
    predicted = np.ones((4, 4), dtype=bool)
    observed = np.zeros((4, 4), dtype=bool)
    observed[:2, :] = True

    valid = np.zeros((4, 4), dtype=bool)
    valid[:2, :] = True
    assert hazard_skill(predicted, observed, valid).csi == 1.0


def test_shape_mismatch_raises() -> None:
    with pytest.raises(ValueError, match="shape mismatch"):
        hazard_skill(np.ones((2, 2), dtype=bool), np.ones((3, 3), dtype=bool))


def test_floor_constant_matches_documented_policy() -> None:
    assert CSI_FLOOR == 0.25
    assert CSI_CEILING_WARNING == 0.70
