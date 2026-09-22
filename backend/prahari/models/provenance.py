"""Provenance envelope. Every ingested value knows where it came from."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class Confidence(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    DERIVED = "DERIVED"


class Provenance(BaseModel):
    source_id: str
    authority: str
    url: str | None = None
    licence: str = "unknown"
    retrieved_at: datetime
    content_sha256: str | None = None
    is_synthetic: bool = False
    confidence: Confidence = Confidence.MEDIUM
    caveats: list[str] = Field(default_factory=list)

    def derive(self, source_id: str, **over: object) -> Provenance:
        """Derived artefacts inherit is_synthetic. Synthetic-ness propagates."""
        data = self.model_dump()
        data.update(source_id=source_id, confidence=Confidence.DERIVED, **over)
        return Provenance(**data)
