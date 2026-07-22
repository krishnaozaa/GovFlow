import fs from "node:fs";
import crypto from "node:crypto";

const schema = fs.readFileSync("schemas/govflow-workflow.schema.json");
const expected = fs.readFileSync("packages/generated-types/schema.sha256", "utf8").trim();
const actual = crypto.createHash("sha256").update(schema).digest("hex");
if (actual !== expected) {
  console.error("Generated GovFlow types are out of date. Regenerate packages/generated-types.");
  process.exit(1);
}
