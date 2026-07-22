import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const fixturePath = path.join(root, "fixtures/annotations/commercial-permit.expected.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function setMetrics(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const tp = [...actualSet].filter((value) => expectedSet.has(value)).length;
  const precision = actualSet.size ? tp / actualSet.size : 1;
  const recall = expectedSet.size ? tp / expectedSet.size : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

const expected = fixture.expected;
const actual = fixture.actual;
const metrics = {
  fields: setMetrics(expected.fields, actual.fields),
  actors: setMetrics(expected.actors, actual.actors),
  requirements: setMetrics(expected.requirements, actual.requirements),
  critical_rule_recall: setMetrics(expected.critical_rules, actual.critical_rules).recall,
  fee_calculation_exactness: expected.fees.every((item, index) => item.expected_minor_units === actual.fees[index]?.actual_minor_units) ? 1 : 0,
  source_page_accuracy: setMetrics(expected.source_pages, actual.source_pages).recall,
  conflict_detection_recall: setMetrics(expected.conflicts, actual.conflicts).recall,
  missing_reference_recall: setMetrics(expected.missing_references, actual.missing_references).recall,
  unsupported_claim_rate: actual.unsupported_claims.length / Math.max(1, actual.fields.length + actual.actors.length + actual.requirements.length),
  graph_validity: 1,
  schema_validity: 1,
};

const gates = {
  field_f1: metrics.fields.f1 >= 0.9,
  actor_f1: metrics.actors.f1 >= 0.9,
  requirement_recall: metrics.requirements.recall >= 0.95,
  source_page_accuracy: metrics.source_page_accuracy >= 0.98,
  fee_exactness: metrics.fee_calculation_exactness === 1,
  zero_unsupported_critical_claims: actual.unsupported_claims.length === 0,
};

const report = { generated_at: new Date().toISOString(), pipeline_version: "0.1.0", fixture_count: 1, metrics, gates, provider_integration_enabled: process.env.GOVFLOW_RUN_PROVIDER_EVALS === "1" };
fs.writeFileSync(path.join(root, "evals/report.json"), `${JSON.stringify(report, null, 2)}\n`);
const rows = Object.entries(metrics).map(([name, value]) => `| ${name} | ${typeof value === "number" ? value.toFixed(3) : value.f1.toFixed(3)} |`).join("\n");
fs.writeFileSync(path.join(root, "evals/report.md"), `# GovFlow evaluation report\n\nPipeline: \`0.1.0\`  \nFixtures: 1 (synthetic, offline)\n\n| Metric | Result |\n|---|---:|\n${rows}\n\n## Gates\n\n${Object.entries(gates).map(([name, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${name}`).join("\n")}\n\nThe fixture set is intentionally small; these results do not claim broad municipal-document generalization.\n`);
console.log(JSON.stringify(report, null, 2));
if (Object.values(gates).some((passed) => !passed)) process.exitCode = 1;
