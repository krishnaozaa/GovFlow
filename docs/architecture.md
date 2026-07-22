# Architecture

GovFlow is a policy-compilation pipeline, not a retrieval chatbot. The browser is an untrusted client; API authorization and publication decisions are server-owned.

```text
PDF / CSV / HTML / user note
          │
          ▼
secure ingestion ──► immutable bytes + source version
          │
          ▼
page inspection ──► native blocks / AcroForm / selective OCR / coordinates
          │
          ▼
staged extraction ──► evidence-backed claims (provider-neutral)
          │
          ▼
reconciliation ──► conflicts + unresolved references + aliases
          │
          ▼
deterministic compiler ──► canonical node/edge graph + typed rules/fees
          │
          ▼
human review ──► decisions + shadow notes + immutable audit events
          │
          ▼
publication gate ──► immutable version ──► JSON / schema / Mermaid / reports
```

The web surface is a Next.js application with React Flow. Hosted structured state is modeled for D1 and uploaded bytes for R2. The FastAPI service supplies the local/portable processing boundary. Its repository is SQLite in this slice; PostgreSQL is the production target. Model calls cannot access tools or networks beyond the provider request itself. Documents are structurally delimited as untrusted source data.

Trust boundaries are: browser/API, API/object store, worker/model provider, and organization-to-organization. Every object lookup is tenant-qualified or checked through its owning project before use. Audit records store identifiers and safe metadata, never whole excerpts or signed URLs.

Analysis jobs move through `queued → inspecting → normalizing → extracting → reconciling → compiling → complete`, with `cancelled` and `failed` terminal states. Progress is available through polling or SSE. Each extraction records provider, model, prompt, schema, and pipeline versions.
