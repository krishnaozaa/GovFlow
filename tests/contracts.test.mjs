import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = JSON.parse(fs.readFileSync("schemas/govflow-workflow.schema.json", "utf8"));
const extraction = JSON.parse(fs.readFileSync("schemas/extraction.schema.json", "utf8"));
const rules = JSON.parse(fs.readFileSync("schemas/rule-expression.schema.json", "utf8"));

test("schemas use Draft 2020-12 and fixed canonical version", () => {
  for (const schema of [workflow, extraction, rules]) assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(workflow.properties.schema_version.const, "1.0.0");
});

test("material origins and extraction methods are closed enums", () => {
  assert.deepEqual(workflow.$defs.origin.enum, ["explicit", "inferred", "user_added", "unknown", "conflicted"]);
  assert.ok(workflow.$defs.evidence.properties.extraction_method.enum.includes("ocr"));
  assert.ok(workflow.$defs.evidence.properties.extraction_method.enum.includes("user"));
});

test("safe rule schema does not accept arbitrary code operators", () => {
  const serialized = JSON.stringify(rules);
  assert.ok(!serialized.includes('"eval"'));
  assert.ok(!serialized.includes('"sql"'));
  assert.ok(serialized.includes('"all"'));
  assert.ok(serialized.includes('"greater_than"'));
});
