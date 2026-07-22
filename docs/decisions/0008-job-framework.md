# ADR 0008: Idempotent analysis jobs

**Status:** accepted for vertical slice

Model the pipeline as resumable idempotent stages and expose progress with SSE. The local slice uses FastAPI background tasks; production replaces only the dispatcher with Redis/Celery, preserving stage contracts, cancellation checks, and result keys.
