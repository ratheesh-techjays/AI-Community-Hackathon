"""Model disclosure -- the type-level enforcement of the PRD honesty rules.

A modelled value CANNOT be serialised without its disclosure. Contract tests
C1-C6 assert this. See docs/design/06-api-contracts.md.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ModelClass = Literal["heuristic_index", "parametric_physical", "optimisation"]

# Canonical limitations -- single source of truth shared by the UI panel,
# advisory caveats, and every ModelDisclosure.
SURGE_LIMITATIONS: list[str] = [
    "Static bathtub inundation; no storm dynamics, tide phase, or timing.",
    "No wave setup or runup, which can add more than 1 m.",
    "DEM vertical error (several metres) is comparable to the surge signal "
    "itself in low-relief floodplains.",
    "No river discharge coupling; compound flooding at deltas is unmodelled.",
    "30 m DEM does not resolve embankment crests.",
    "Surge height is a calibrated heuristic index, NOT a validated forecast "
    "model. No published Bay-of-Bengal wind-to-surge formula exists.",
]

PARAMETRIC_LIMITATIONS: list[str] = [
    "Parametric zones are illustrative, not actuarially derived.",
    "Payout matrices are demonstrative of the mechanism only.",
]


class ModelDisclosure(BaseModel):
    """Attached to every response carrying modelled output."""

    model_class: ModelClass
    limitations: list[str] = Field(min_length=1)  # never empty
    validated_against: str | None = None  # e.g. "sentinel1_sar_fani_2019"
    skill_metric: dict[str, float] | None = None  # {"csi": 0.38, "pod": 0.61}

    @classmethod
    def surge(cls) -> ModelDisclosure:
        return cls(model_class="heuristic_index", limitations=SURGE_LIMITATIONS)

    @classmethod
    def parametric(cls) -> ModelDisclosure:
        return cls(model_class="optimisation", limitations=PARAMETRIC_LIMITATIONS)
