# ADR 0006: Model-provider abstraction

**Status:** accepted

Semantic extraction depends on a provider protocol with production, deterministic mock, and replay implementations. Model IDs, prompt versions, schema versions, and pipeline versions are injected and recorded. CI never requires a paid provider.
