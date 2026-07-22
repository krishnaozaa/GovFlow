# GovFlow evaluation report

Pipeline: `0.1.0`  
Fixtures: 1 (synthetic, offline)

| Metric | Result |
|---|---:|
| fields | 1.000 |
| actors | 1.000 |
| requirements | 1.000 |
| critical_rule_recall | 1.000 |
| fee_calculation_exactness | 1.000 |
| source_page_accuracy | 1.000 |
| conflict_detection_recall | 1.000 |
| missing_reference_recall | 1.000 |
| unsupported_claim_rate | 0.000 |
| graph_validity | 1.000 |
| schema_validity | 1.000 |

## Gates

- PASS: field_f1
- PASS: actor_f1
- PASS: requirement_recall
- PASS: source_page_accuracy
- PASS: fee_exactness
- PASS: zero_unsupported_critical_claims

The fixture set is intentionally small; these results do not claim broad municipal-document generalization.
