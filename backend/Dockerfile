FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Geospatial wheels need these; keep the layer small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gdal-bin libgdal-dev \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY prahari ./prahari
RUN pip install --no-cache-dir .

# Cloud Run injects PORT.
ENV PORT=8080
CMD exec uvicorn prahari.api.main:app --host 0.0.0.0 --port ${PORT}
