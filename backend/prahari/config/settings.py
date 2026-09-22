"""Centralized settings. No secrets in code; everything env-driven."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["local", "staging", "prod"] = "local"
    config_version: str = "v1"

    # --- Gemini -----------------------------------------------------------
    # Flash tier only. Pro was removed from the free tier on 2026-04-01 and
    # free quotas were cut sharply in Dec 2025 -- enable billing before demo.
    gemini_api_key: str = ""
    gemini_model_extract: str = "gemini-2.5-flash"
    gemini_model_narrate: str = "gemini-2.5-flash"
    gemini_model_query: str = "gemini-2.5-flash"
    enable_ai: bool = True  # kill switch -> full template fallback
    ai_timeout_s: float = 30.0
    ai_max_retries: int = 2

    # --- Earth Engine -----------------------------------------------------
    gee_project: str = ""
    gee_service_account: str = ""
    gee_key_path: str = ""
    gee_high_volume_endpoint: str = "https://earthengine-highvolume.googleapis.com"
    gee_max_concurrent: int = 30  # stay under the ~40 concurrent quota

    # --- Storage ----------------------------------------------------------
    gcs_bucket: str = "prahari-artifacts"
    database_url: str = "postgresql+psycopg://prahari:prahari@localhost:5432/prahari"

    # --- Limits -----------------------------------------------------------
    max_aoi_area_km2: float = 50_000.0  # guards raster memory; -> HTTP 413


@lru_cache
def get_settings() -> Settings:
    return Settings()
