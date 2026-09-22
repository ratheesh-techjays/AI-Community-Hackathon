.PHONY: install dev test test-all lint fmt typecheck check docker data

install:
	pip install -e ".[dev]"

dev:
	uvicorn prahari.api.main:app --reload --port 8080

test:
	pytest -m "not network and not gee"

test-all:
	pytest

lint:
	ruff check prahari tests

fmt:
	ruff format prahari tests && ruff check --fix prahari tests

typecheck:
	mypy prahari

check: lint typecheck test

docker:
	docker build -t prahari-api .

data:
	@python -c "from prahari.config.paths import IBTRACS_CSV; from prahari.ingestion.tracks.ibtracs import download; p = download(IBTRACS_CSV); print(f'IBTrACS ready: {p} ({p.stat().st_size/1e6:.1f} MB)')"
