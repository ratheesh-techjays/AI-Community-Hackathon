"""Gemini client: one place for model ids, timeouts, retries and the kill switch.

Every call returns None on any failure. Callers treat None as "use the
template": an AI failure degrades to a worse sentence, never to an error
(api/errors.py, the deliberate asymmetry).
"""

from __future__ import annotations

import logging
import time
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from prahari.config.settings import Settings, get_settings

log = logging.getLogger("prahari.ai")
T = TypeVar("T", bound=BaseModel)
PROBE_TTL_S = 300.0


class AIClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._client: Any = None
        self._probe: tuple[float, bool] | None = None
        if self.settings.enable_ai and self.settings.gemini_api_key:
            from google import genai
            from google.genai import types

            self._client = genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=int(self.settings.ai_timeout_s * 1000)),
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    def generate_json(self, model: str, system: str, prompt: str, schema: type[T]) -> T | None:
        """Schema-constrained generation. None on disabled, timeout, 429 or bad JSON."""
        if self._client is None:
            return None
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=schema,
        )
        for attempt in range(self.settings.ai_max_retries + 1):
            started = time.perf_counter()
            try:
                response = self._client.models.generate_content(
                    model=model, contents=prompt, config=config
                )
                text = response.text or ""
                log.info(
                    "gemini ok model=%s ms=%.0f", model, (time.perf_counter() - started) * 1000
                )
                return schema.model_validate_json(text)
            except ValidationError as exc:
                log.warning("gemini schema violation: %s", exc.errors()[:1])
                prompt = f"{prompt}\n\nYour previous output was not valid JSON for the schema."
            except Exception as exc:  # network, quota, safety block: all mean "template"
                log.warning("gemini call failed (attempt %d): %s", attempt + 1, exc)
                time.sleep(min(2**attempt, 4))
        return None

    def chat(self, model: str, system: str, contents: list[Any], tools: list[Any]) -> Any | None:
        """One function-calling turn. Returns the raw response or None."""
        if self._client is None:
            return None
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.1,
            tools=tools,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        try:
            return self._client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except Exception as exc:
            log.warning("gemini chat failed: %s", exc)
            return None

    def reachable(self) -> bool:
        """Cheap metadata call, cached for five minutes, for /healthz."""
        if self._client is None:
            return False
        now = time.monotonic()
        if self._probe and now - self._probe[0] < PROBE_TTL_S:
            return self._probe[1]
        try:
            self._client.models.get(model=self.settings.gemini_model_narrate)
            ok = True
        except Exception:
            ok = False
        self._probe = (now, ok)
        return ok


_default: AIClient | None = None


def get_ai_client() -> AIClient:
    global _default
    if _default is None:
        _default = AIClient()
    return _default
