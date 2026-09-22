"""Storm surge heuristic index.

READ THIS BEFORE QUOTING ANY NUMBER FROM THIS MODULE.

No published, citable Bay-of-Bengal wind-to-surge formula exists. The real
literature (Dube/Rao/Sinha lineage behind IMD/INCOIS operations, Johns 1985,
Flather 1994) is dynamical shallow-water modelling, not a plug-in equation.

This is a TRANSPARENT HEURISTIC INDEX, not a validated forecast model. The
calibration figures below were fitted against observed surge values that have
NOT been verified against primary sources (IMD Preliminary Reports) -- which is
why `calibration_rmse_m` is None and must stay None until someone does that work.

Credibility for this project rests on the SAR-validated flood EXTENT
(see prahari.evals.metrics), never on the surge height.
"""

from __future__ import annotations

from dataclasses import dataclass

from prahari.models.disclosure import ModelDisclosure
from prahari.models.hazard import SurgeEstimate

KT_TO_MS = 0.514444

# Bay of Bengal shelf geometry amplification. Illustrative.
FUNNEL_AMPLIFICATION: dict[str, float] = {
    "head_of_bay": 1.6,  # Sundarbans, north Odisha, West Bengal
    "central": 1.0,  # central Odisha, Andhra Pradesh
    "south": 0.7,  # Tamil Nadu
}


@dataclass(frozen=True)
class SurgeModel:
    coefficient: float = 7.5e-4
    calibration_rmse_m: float | None = None  # stays None until primary-verified
    model_class: str = "heuristic_index"

    def estimate(
        self,
        vmax_kt: float,
        funnel_amplification: float,
        imd_forecast_surge_m: str | None = None,
    ) -> SurgeEstimate:
        vmax_ms = vmax_kt * KT_TO_MS
        peak = self.coefficient * (vmax_ms**2) * funnel_amplification
        return SurgeEstimate(
            peak_surge_m=round(peak, 2),
            funnel_amplification=funnel_amplification,
            coefficient=self.coefficient,
            imd_forecast_surge_m=imd_forecast_surge_m,
            disclosure=ModelDisclosure.surge(),
        )


DEFAULT_SURGE_MODEL = SurgeModel()
