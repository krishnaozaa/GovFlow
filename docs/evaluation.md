# Evaluation

`npm run eval` reads committed golden annotations and writes `evals/report.json` plus `evals/report.md`. It requires no network and no paid model call. Provider integration is opt-in behind `GOVFLOW_RUN_PROVIDER_EVALS=1`.

Metrics include field/actor/requirement precision, recall and F1; critical-rule recall; exact and semantic rule match; fee exactness; source-page accuracy; bounding-box IoU; unsupported-claim rate; graph validity; conflict recall; missing-reference recall; latency; cost; and reviewer correction rate.

Release gates are the targets in the product brief. The harness reports measured values honestly and exits non-zero when a configured gate fails. The initial fixture set is intentionally small, so passing the harness does not claim broad municipal-document generalization.
