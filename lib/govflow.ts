export type Origin = "explicit" | "inferred" | "user_added" | "unknown" | "conflicted";
export type Severity = "informational" | "warning" | "blocking" | "fatal";

export interface Evidence {
  documentVersionId: string;
  documentTitle: string;
  pageNumber: number;
  bbox: [number, number, number, number];
  text: string;
  textStart: number;
  textEnd: number;
  sourceHash: string;
  extractionMethod: "native_text" | "acroform" | "ocr" | "vision" | "html" | "csv" | "user";
}

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
  actor: string;
  origin: Origin;
  confidence: number;
  reviewStatus: "reviewed" | "unreviewed" | "needs_attention";
  evidence: Evidence[];
  description: string;
}

export interface ReviewIssue {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  type: string;
  status: "open" | "resolved" | "dismissed";
  nodeId?: string;
  documentTitle?: string;
}

export const evidence = {
  intake: {
    documentVersionId: "31fb08f3-8f73-4b57-9f27-a167d541f954",
    documentTitle: "Building Permit Application.pdf",
    pageNumber: 1,
    bbox: [0.112, 0.184, 0.896, 0.302] as [number, number, number, number],
    text: "A complete application, including project address, valuation, and owner authorization, must be submitted before plan review.",
    textStart: 148,
    textEnd: 267,
    sourceHash: "sha256:ac7495efed1c9f9b",
    extractionMethod: "native_text" as const,
  },
  completeness: {
    documentVersionId: "68483910-36b2-4d38-a4d7-19199dd4fa43",
    documentTitle: "Commercial Submittal Checklist.pdf",
    pageNumber: 2,
    bbox: [0.098, 0.401, 0.905, 0.512] as [number, number, number, number],
    text: "Staff shall review the submittal for completeness within 5 business days. Incomplete applications will be returned with a deficiency notice.",
    textStart: 824,
    textEnd: 965,
    sourceHash: "sha256:7f06b18c46a1f24a",
    extractionMethod: "ocr" as const,
  },
  review: {
    documentVersionId: "6bb001a4-7ad2-4b17-8456-15749badd451",
    documentTitle: "Permit Review Instructions.html",
    pageNumber: 1,
    bbox: [0.08, 0.275, 0.92, 0.356] as [number, number, number, number],
    text: "Building and Fire Prevention review may proceed concurrently when the application is deemed complete.",
    textStart: 416,
    textEnd: 519,
    sourceHash: "sha256:85b912c915c08aca",
    extractionMethod: "html" as const,
  },
  payment: {
    documentVersionId: "07f5916c-7282-4a32-b365-6aaf8d97e691",
    documentTitle: "FY2025 Development Fees.csv",
    pageNumber: 1,
    bbox: [0.0, 0.0, 1.0, 1.0] as [number, number, number, number],
    text: "Commercial plan review,base_fee,500.00,effective 2025-01-01",
    textStart: 47,
    textEnd: 111,
    sourceHash: "sha256:ce2198c784ab9f18",
    extractionMethod: "csv" as const,
  },
};

export const initialNodes = [
  { id: "start", type: "input", position: { x: 290, y: 20 }, data: { label: "Application received", kind: "start", actor: "Permit Center", origin: "explicit", confidence: 0.99, reviewStatus: "reviewed", evidence: [evidence.intake], description: "Application package enters the permit workflow." } },
  { id: "completeness", position: { x: 290, y: 145 }, data: { label: "Completeness review", kind: "validation", actor: "Permit Technician", origin: "explicit", confidence: 0.96, reviewStatus: "reviewed", evidence: [evidence.completeness], description: "Confirm all required forms and attachments are present." } },
  { id: "complete", position: { x: 290, y: 280 }, data: { label: "Application complete?", kind: "decision", actor: "Permit Technician", origin: "explicit", confidence: 0.93, reviewStatus: "reviewed", evidence: [evidence.completeness], description: "Routes incomplete applications to deficiency notice." } },
  { id: "deficiency", position: { x: 25, y: 420 }, data: { label: "Send deficiency notice", kind: "notification", actor: "Permit Technician", origin: "explicit", confidence: 0.94, reviewStatus: "reviewed", evidence: [evidence.completeness], description: "Notify applicant of missing items and await resubmittal." } },
  { id: "parallel", position: { x: 485, y: 420 }, data: { label: "Concurrent review", kind: "parallel_split", actor: "Review Coordinator", origin: "explicit", confidence: 0.91, reviewStatus: "unreviewed", evidence: [evidence.review], description: "Building and fire review proceed in parallel." } },
  { id: "building", position: { x: 370, y: 560 }, data: { label: "Building review", kind: "department_review", actor: "Building Division", origin: "explicit", confidence: 0.95, reviewStatus: "reviewed", evidence: [evidence.review], description: "Technical plan review by Building Division." } },
  { id: "fire", position: { x: 625, y: 560 }, data: { label: "Fire review", kind: "department_review", actor: "Fire Prevention", origin: "explicit", confidence: 0.92, reviewStatus: "reviewed", evidence: [evidence.review], description: "Fire and life-safety review." } },
  { id: "payment", position: { x: 500, y: 705 }, data: { label: "Collect permit fees", kind: "payment", actor: "Cashier", origin: "conflicted", confidence: 0.68, reviewStatus: "needs_attention", evidence: [evidence.payment], description: "Collect calculated plan review and permit fees." } },
  { id: "approval", type: "output", position: { x: 500, y: 845 }, data: { label: "Permit approved", kind: "approval", actor: "Building Official", origin: "explicit", confidence: 0.97, reviewStatus: "reviewed", evidence: [evidence.intake], description: "Issue the approved permit package." } },
] satisfies Array<{ id: string; type?: string; position: { x: number; y: number }; data: FlowNodeData }>;

export const initialEdges = [
  { id: "e-start-completeness", source: "start", target: "completeness" },
  { id: "e-completeness-complete", source: "completeness", target: "complete" },
  { id: "e-complete-deficiency", source: "complete", target: "deficiency", label: "No" },
  { id: "e-deficiency-completeness", source: "deficiency", target: "completeness", label: "Resubmitted", animated: true },
  { id: "e-complete-parallel", source: "complete", target: "parallel", label: "Yes" },
  { id: "e-parallel-building", source: "parallel", target: "building", label: "Building" },
  { id: "e-parallel-fire", source: "parallel", target: "fire", label: "Fire" },
  { id: "e-building-payment", source: "building", target: "payment" },
  { id: "e-fire-payment", source: "fire", target: "payment" },
  { id: "e-payment-approval", source: "payment", target: "approval" },
];

export const initialIssues: ReviewIssue[] = [
  { id: "issue-fee", title: "Conflicting commercial plan review fee", detail: "The FY2025 schedule states $500, while the application instructions state $450. Select the controlling source and record a reason.", severity: "fatal", type: "conflicting_sources", status: "open", nodeId: "payment", documentTitle: "FY2025 Development Fees.csv" },
  { id: "issue-discretion", title: "Discretionary fire review language", detail: "“May require additional review” does not identify a decision-maker or triggering condition.", severity: "blocking", type: "discretionary_language", status: "open", nodeId: "fire", documentTitle: "Permit Review Instructions.html" },
  { id: "issue-version", title: "Checklist has no visible effective date", detail: "Confirm that the supplied commercial checklist is current before publication.", severity: "warning", type: "missing_version_date", status: "open", nodeId: "completeness", documentTitle: "Commercial Submittal Checklist.pdf" },
];

export function validateGraph(nodes: Array<{ id: string; type?: string; data: FlowNodeData }>, edges: Array<{ source: string; target: string }>, issues: ReviewIssue[]) {
  const errors: string[] = [];
  const ids = new Set(nodes.map((node) => node.id));
  if (nodes.filter((node) => node.type === "input").length !== 1) errors.push("Workflow must contain exactly one start node.");
  if (!nodes.some((node) => node.type === "output")) errors.push("Workflow must contain at least one terminal node.");
  for (const edge of edges) if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push("Workflow contains a dangling edge.");
  for (const node of nodes) {
    if (node.type !== "output" && !edges.some((edge) => edge.source === node.id)) errors.push(`${node.data.label} has no outgoing path.`);
    if ((node.data.origin === "explicit" || node.data.origin === "inferred") && node.data.evidence.length === 0) errors.push(`${node.data.label} has no supporting evidence.`);
  }
  const blocking = issues.filter((issue) => issue.status === "open" && (issue.severity === "fatal" || issue.severity === "blocking"));
  return { valid: errors.length === 0 && blocking.length === 0, errors, blocking };
}

export function calculatePlanReviewFee(squareFeet: number) {
  if (!Number.isFinite(squareFeet) || squareFeet < 0) throw new Error("Square footage must be a non-negative number.");
  const baseCents = 50000;
  const perSquareFootCents = 25;
  const variableCents = Math.round(squareFeet * perSquareFootCents);
  return Math.max(baseCents, variableCents);
}

export function toMermaid(nodes: Array<{ id: string; data: FlowNodeData }>, edges: Array<{ source: string; target: string; label?: unknown }>) {
  const lines = ["flowchart TD"];
  for (const node of nodes) lines.push(`  ${node.id}[\"${node.data.label.replaceAll('"', "'")}\"]`);
  for (const edge of edges) lines.push(`  ${edge.source} -->${edge.label ? `|${String(edge.label)}|` : ""} ${edge.target}`);
  return lines.join("\n");
}
