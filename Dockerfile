# PRAHARI API image. Built from the repo root so it carries data/: the OSDMA
# shelter register and the precomputed demo runs, which make the demo a cache
# hit with no Earth Engine or Gemini call in the request path.
#
#   docker build -t prahari-api .
#   gcloud run deploy prahari-api --source . ...   (see deploy/deploy.ps1)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PRAHARI_REPO_ROOT=/app
WORKDIR /app

COPY backend/pyproject.toml backend/
COPY backend/prahari backend/prahari
RUN pip install --no-cache-dir ./backend

COPY data data

# Run unprivileged; the run store under data/runs must stay writable.
RUN useradd --create-home --uid 10001 prahari && chown -R prahari /app/data
USER prahari

# Cloud Run injects PORT. prod refuses writes without PRAHARI_API_KEY.
ENV PORT=8080 PRAHARI_ENV=prod
CMD exec uvicorn prahari.api.main:app --host 0.0.0.0 --port ${PORT}
