// Generated contract surface for schema v1.0.0. Keep in sync with the schema hash.
export type Origin = "explicit" | "inferred" | "user_added" | "unknown" | "conflicted";
export type ExtractionMethod = "native_text" | "acroform" | "ocr" | "vision" | "html" | "csv" | "user";
export interface Evidence {
  document_version_id: string;
  page_number: number;
  bbox: [number, number, number, number];
  text: string;
  text_start: number;
  text_end: number;
  source_hash: string;
  extraction_method: ExtractionMethod;
}
export interface MaterialObject {
  id: string;
  name: string;
  origin: Origin;
  confidence: number;
  evidence: Evidence[];
}
export interface CanonicalWorkflow {
  schema_version: "1.0.0";
  workflow_id: string;
  project_id: string;
  title: string;
  jurisdiction: { name: string; state_or_region?: string; country: string };
  sources: unknown[];
  actors: MaterialObject[];
  fields: MaterialObject[];
  requirements: MaterialObject[];
  statuses: MaterialObject[];
  workflow: { nodes: MaterialObject[]; edges: unknown[] };
  decision_rules: unknown[];
  fee_rules: MaterialObject[];
  deadlines: MaterialObject[];
  issues: unknown[];
  metadata: { created_at: string; pipeline_version: string; prompt_version: string; model_runs: unknown[] };
}
