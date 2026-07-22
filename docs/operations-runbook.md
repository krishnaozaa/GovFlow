# Operations runbook

- **Stuck job:** inspect queue age, job state, worker heartbeat, and correlation ID; retry only idempotent incomplete stages. Never print page text.
- **Failed migration:** stop writes, preserve the database, run the migration check, and restore the last verified backup if rollback is supported.
- **Storage outage:** pause ingestion and exports; do not mark document versions complete until object persistence is confirmed.
- **Model outage:** keep deterministic ingestion available, mark semantic stages retryable, and never silently switch to weaker inferred output.
- **Redis outage:** pause queue dispatch; API reads and edits remain available. Resume idempotent jobs after recovery.
- **Corrupted document:** quarantine the immutable version, show an actionable user error, retain its hash, and do not repeatedly parse it.
- **Excessive spend:** disable the production provider through configuration, cancel queued model stages, retain normalized sources, and use replay/mock only for tests.
- **Sensitive upload:** restrict access, revoke signed URLs, open a security event, apply the organization retention/deletion policy, and avoid copying content into incident tools.
- **Deletion request:** verify scope and authority, soft-delete immediately, run the hard-deletion job, verify object and derivative removal, and record only identifiers in the audit event.

Health endpoints must check API reachability, database writes, storage access, queue connectivity, and worker liveness separately. Production alerts cover queue duration, processing duration, OCR rate, model latency/retries/tokens, extraction failures, validation failures, blockers, and export failures.
