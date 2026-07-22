# Canonical workflow schema

The canonical contract is [GovFlow Workflow Schema](../schemas/govflow-workflow.schema.json), JSON Schema Draft 2020-12, version `1.0.0`. Mermaid is derived output and never canonical state.

Every actor, field, requirement, node, rule, fee, and deadline has an origin, confidence, and evidence list. `explicit` and `inferred` objects require evidence; `user_added` objects identify their human author through a shadow-process note; unresolved values use `unknown`; contradictions use `conflicted` until a reviewer chooses a controlling source and explains why.

Minor changes add optional properties without changing the major version. Breaking semantic or required-property changes increment the major version. Readers must reject unsupported major versions. Published objects and source versions are immutable.

Conditions use [Safe Rule Expression](../schemas/rule-expression.schema.json). Money is evaluated as `Decimal` and returned as integer minor units. Coordinates are normalized `[x0,y0,x1,y1]` in the inclusive `0..1` range.
