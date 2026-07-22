# Data retention

The default active-data retention period is 365 days and is organization-configurable by an `org_admin`. Deletion marks a project or source as deleted immediately, revokes future signed URLs, hides it from normal queries, and records an audit event. A scheduled job hard-deletes bytes and derived page images after the configured recovery window.

Database backups may retain encrypted deleted records for up to 35 additional days. Audit events are retained for seven years by default but contain identifiers and safe metadata rather than document content. A legal hold, when explicitly configured by an authorized administrator, suspends hard deletion and is itself audited. Development environments use disposable storage and must not receive real sensitive documents.
