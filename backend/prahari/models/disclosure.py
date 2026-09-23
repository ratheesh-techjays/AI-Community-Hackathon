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


EXPOSURE_LIMITATIONS: list[str] = [
    *SURGE_LIMITATIONS,
    "Population is WorldPop 2019 (100 m, modelled), not a census count.",
    "Buildings are Open Buildings v3 footprints at confidence >= 0.7; rural "
    "thatch roofs are under-detected.",
    "Hospitals, roads and power assets are not yet ingested.",
]

DECISION_LIMITATIONS: list[str] = [
    "Shelter capacity is imputed from shelter type; OSDMA publishes none.",
    "Travel distance is straight-line x 1.3 detour; no road network, so "
    "road flooding before evacuation is not modelled.",
    "Evacuation demand is the population of modelled flood cells only; wind "
    "and rain exposure are not added to demand.",
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
        # The trigger reads the heuristic flood and modelled wind: it is no
        # stronger than its weakest input.
        return cls(model_class="heuristic_index", limitations=PARAMETRIC_LIMITATIONS)

    @classmethod
    def exposure(cls) -> ModelDisclosure:
        return cls(model_class="heuristic_index", limitations=EXPOSURE_LIMITATIONS)

    @classmethod
    def decision(cls) -> ModelDisclosure:
        return cls(model_class="optimisation", limitations=DECISION_LIMITATIONS)

    def with_skill(self, validated_against: str | None, skill: dict[str, float]) -> ModelDisclosure:
        """Attach a measured skill score. Only the validation stage calls this.

        `validated_against` stays None when the score is below the floor: a
        measured-but-failed validation is reported, never presented as a pass.
        """
        return self.model_copy(
            update={"validated_against": validated_against, "skill_metric": skill}
        )
