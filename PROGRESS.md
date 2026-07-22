# GovFlow AI implementation progress

Updated: 2026-07-22

## Repository assessment

The workspace was empty: there were no useful components, source files, tests, or Git history to preserve. The repository was initialized with a Cloudflare-compatible Next.js/Vinext web surface and then shaped into the GovFlow monorepo.

Missing production capabilities at assessment time included every requested area: canonical contracts, persistent entities, ingestion, provenance, authorization, document processing, model adapters, reconciliation, deterministic rules and fees, graph validation, publication controls, exports, review UI, operations, tests, and documentation.

## Architectural decisions

- Canonical state is typed JSON governed by Draft 2020-12 schemas; the graph is nodes and edges, never Mermaid.
- The review surface uses Next.js, strict TypeScript, React Flow, D1 metadata, and R2 object declarations.
- The local ingestion service uses FastAPI with a deliberately narrow SQLite repository. The repository boundary permits a PostgreSQL implementation without changing API/domain code.
- PDF/CSV bytes are stored outside the web root under an organization-scoped internal key. Names are generated from content hashes.
- Model interpretation is staged behind a provider-neutral protocol. CI uses deterministic fixtures; paid calls are opt-in.
- Rules and fees use application-owned AST interpreters. Invalid or unresolved expressions fail closed.
- Publication is a deterministic gate over graph integrity, evidence completeness, fee/rule validity, and unresolved critical issues.
- Tenant checks occur in repository/API code, returning non-enumerable `404` responses across tenants.

## Phase status

### Phase 0 — complete

- Monorepo layout, lockfiles, strict TypeScript, Python types, schema contracts, CI skeleton, Docker files, ADRs, threat model, runbook, and this progress record.

### Phase 1 — complete for the vertical slice

- Secure PDF/CSV allowlist and magic-byte checks.
- SHA-256 deduplication and generated internal names.
- Tenant-scoped storage outside the web root.
- Page-quality and normalized-coordinate helpers that choose OCR only when needed.
- Source-linked three-pane viewer with exact excerpts and method labels.
- Organization/project creation, upload, source list, shadow note, analysis start/status/cancel/SSE endpoints.
- Synthetic offline fixtures and unit/integration tests.

### Phase 2 — functional core, expansion pending

- Provider protocol, deterministic mock, replay, and schema-constrained OpenAI adapter.
- Explicit prompt-injection trust boundary.
- Evidence-enforcing claim models.
- Remaining: connect PyMuPDF page blocks and optional Tesseract to persisted spans; implement all ten specialized extraction stages against production documents.

### Phase 3 — functional core, expansion pending

- Safe condition/fee AST interpreter with Decimal calculations and rounding.
- Deterministic graph validator and publication blocker behavior.
- Canonical JSON, Mermaid, and issue export in the workspace.
- Remaining: persist reconciliation decisions and compile every domain entity from analysis runs.

### Phase 4 — interactive demo complete, persistence expansion pending

- Editable React Flow graph, source selection, evidence highlight, drag/connect, undo/redo, node edits, review status, issue queue, shadow-note modal, conflict-resolution modal, fee preview, keyboard focus, and non-color status text.
- Remaining: server-persist graph edits with optimistic concurrency, full version comparison, delete/restore, and automated WCAG/browser testing.

### Phase 5 — partially complete

- Publication gate UI, immutable-version data tables, audit-event tables, export surface, retention design, containers, metrics plan, threat model, and runbook.
- Remaining: API workflow-version/publish/export endpoints, scheduled hard deletion, signed object URLs, OpenTelemetry exporter, and production PostgreSQL/Celery deployment.

## Verified path

- `npm run build` — passes.
- `npm run lint` — passes without warnings.
- API unit/integration/security suite — 13 tests pass.
- Evaluation harness — emits JSON and Markdown without network or paid calls.

## Architectural deviations

The brief recommends PostgreSQL, Redis, Celery, and MinIO. The first vertical slice keeps the runnable local path small: SQLite plus API background tasks, and hosted D1/R2 declarations. The boundaries are explicit and the missing production adapters are not represented as complete. This avoids running unused infrastructure while deterministic ingestion and review behavior are established.
