# GovFlow AI

GovFlow AI compiles government forms, checklists, fee schedules, webpages, and reviewer-supplied operational notes into an evidence-backed digital workflow. It is not a document chatbot and does not provide legal advice. Every material claim is labeled `explicit`, `inferred`, `user_added`, `unknown`, or `conflicted`; explicit and inferred claims require source evidence.

This repository currently delivers the first production-shaped vertical slice: a source-linked review workspace, secure PDF/CSV ingestion API, tenant authorization, staged provider abstraction, asynchronous analysis status, deterministic rules and fee calculations, graph validation, publication blocking, canonical schema, exports, fixtures, tests, and documentation.

## Quick start

Prerequisites: Node.js 22.13+, Python 3.12+, and Docker (optional).

```bash
cp .env.example .env
npm ci
python3 -m venv services/api/.venv
services/api/.venv/bin/pip install -r services/api/requirements.txt
make dev
```

The review workspace runs at `http://localhost:3000`; the API and its OpenAPI document run at `http://localhost:8000` and `http://localhost:8000/docs`.

For containers:

```bash
docker compose up --build
```

## Demo flow

1. Open the seeded **Commercial Building Permit** workspace.
2. Select graph nodes and inspect the exact source excerpt, page, normalized region, source hash, and extraction method.
3. Choose **Add step** to record a shadow-process note with an author, date, duration, and optional policy reference.
4. Open **Issues**, resolve the seeded `$450`/`$500` fee conflict, and record a reason.
5. Choose **Publish**. Publication remains blocked while the discretionary-language issue is open.
6. Resolve the remaining blocker and publish immutable version `v1.0`.
7. Export canonical JSON, Mermaid, or the issue report. The fee preview uses deterministic decimal-compatible arithmetic and no model call.

## Checks

```bash
npm run lint
npm run build
PYTHONPATH=services/api services/api/.venv/bin/python -m pytest services/api/tests -q
npm run eval
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GOVFLOW_DATA_DIR` | `/tmp/govflow-data` | API database and object directory, outside the web root |
| `GOVFLOW_ALLOWED_ORIGINS` | `http://localhost:3000` | Explicit CORS allowlist |
| `GOVFLOW_EXTRACTION_PROVIDER` | `deterministic-mock` | `deterministic-mock`, `replay`, or `openai` |
| `GOVFLOW_EXTRACTION_MODEL` | `gpt-5-mini` | Injected model identifier; never compiled into the frontend |
| `OPENAI_API_KEY` | unset | Required only for paid provider integration tests/runs |
| `MAX_DOCUMENT_BYTES` | `26214400` | Upload limit |
| `RETENTION_DAYS` | `365` | Default soft-delete retention window |

## Repository map

```text
app/                         Next.js/Vinext review workspace
lib/                         canonical frontend types and validation helpers
services/api/govflow/        FastAPI ingestion and deterministic domain core
schemas/                     JSON Schema Draft 2020-12 contracts
db/                          D1 relational schema for hosted persistence
fixtures/                    offline synthetic and external-document manifests
evals/                       repository-local golden evaluation harness
docs/                        architecture, security, operations, and ADRs
docker/                      production-oriented container definitions
```

## Current limitations

The checked-in vertical slice uses SQLite for the local FastAPI path and D1/R2 declarations for the hosted review surface. Hybrid page extraction quality scoring and adapters are implemented; a full Tesseract worker, PostgreSQL migration, signed object-URL endpoint, version-diff UI, and complete browser suite remain tracked in [PROGRESS.md](PROGRESS.md). The production model adapter is present but deterministic tests never make paid calls.
