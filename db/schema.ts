import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  retentionDays: integer("retention_days").notNull().default(365),
  ...timestamps,
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userEmail: text("user_email").notNull(),
  role: text("role", { enum: ["org_admin", "implementation_engineer", "municipal_reviewer", "viewer"] }).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("membership_org_user").on(table.organizationId, table.userEmail)]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  jurisdiction: text("jurisdiction", { mode: "json" }).notNull(),
  draftRevision: integer("draft_revision").notNull().default(1),
  deletedAt: text("deleted_at"),
  ...timestamps,
});

export const sourceDocuments = sqliteTable("source_documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  classification: text("classification").notNull().default("unknown"),
  deletedAt: text("deleted_at"),
  ...timestamps,
});

export const sourceDocumentVersions = sqliteTable("source_document_versions", {
  id: text("id").primaryKey(),
  sourceDocumentId: text("source_document_id").notNull().references(() => sourceDocuments.id),
  version: integer("version").notNull(),
  sha256: text("sha256").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  analysisStartedAt: text("analysis_started_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("document_version_unique").on(table.sourceDocumentId, table.version)]);

export const sourceSpans = sqliteTable("source_spans", {
  id: text("id").primaryKey(),
  documentVersionId: text("document_version_id").notNull().references(() => sourceDocumentVersions.id),
  pageNumber: integer("page_number").notNull(),
  bbox: text("bbox", { mode: "json" }).notNull(),
  excerpt: text("excerpt").notNull(),
  extractionMethod: text("extraction_method").notNull(),
  sourceHash: text("source_hash").notNull(),
  quality: text("quality", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const analysisRuns = sqliteTable("analysis_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  state: text("state").notNull(),
  progress: integer("progress").notNull().default(0),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  pipelineVersion: text("pipeline_version").notNull(),
  errorCode: text("error_code"),
  ...timestamps,
});

export const workflowDrafts = sqliteTable("workflow_drafts", {
  projectId: text("project_id").primaryKey().references(() => projects.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  revision: integer("revision").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reviewIssues = sqliteTable("review_issues", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  severity: text("severity").notNull(),
  issueType: text("issue_type").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  resolution: text("resolution"),
  ...timestamps,
});

export const workflowVersions = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  version: text("version").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  contentHash: text("content_hash").notNull(),
  publishedAt: text("published_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id"),
  actorEmail: text("actor_email").notNull(),
  eventType: text("event_type").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  metadata: text("metadata", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
});
