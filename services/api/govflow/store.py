from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator
from uuid import UUID, uuid4


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, retention_days INTEGER NOT NULL DEFAULT 365, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), user_email TEXT NOT NULL, role TEXT NOT NULL, UNIQUE(organization_id, user_email));
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), title TEXT NOT NULL, jurisdiction TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, classification TEXT NOT NULL DEFAULT 'unknown', created_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS document_versions (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), version INTEGER NOT NULL, sha256 TEXT NOT NULL, storage_key TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, analysis_started_at TEXT, created_at TEXT NOT NULL, UNIQUE(document_id, version));
CREATE TABLE IF NOT EXISTS analysis_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, state TEXT NOT NULL, progress INTEGER NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, pipeline_version TEXT NOT NULL, cancel_requested INTEGER NOT NULL DEFAULT 0, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shadow_notes (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, author TEXT NOT NULL, recorded_at TEXT NOT NULL, description TEXT NOT NULL, policy_reference TEXT, duration TEXT NOT NULL, creates TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts (project_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, severity TEXT NOT NULL, issue_type TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL, resolution TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workflow_versions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, version TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL, published_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, actor_email TEXT NOT NULL, event_type TEXT NOT NULL, object_type TEXT NOT NULL, object_id TEXT NOT NULL, correlation_id TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL);
"""


class NotFoundError(LookupError): pass
class AuthorizationError(PermissionError): pass
class RevisionConflictError(RuntimeError): pass


class Store:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.executescript(SCHEMA)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def create_organization(self, name: str, actor_email: str) -> dict[str, Any]:
        organization_id, now = str(uuid4()), datetime.now(UTC).isoformat()
        with self.connection() as db:
            db.execute("INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)", (organization_id, name, now))
            db.execute("INSERT INTO memberships(id,organization_id,user_email,role) VALUES(?,?,?,?)", (str(uuid4()), organization_id, actor_email, "org_admin"))
        return {"id": organization_id, "name": name, "retention_days": 365, "created_at": now}

    def authorize(self, organization_id: str, actor_email: str, allowed_roles: set[str] | None = None) -> str:
        with self.connection() as db:
            row = db.execute("SELECT role FROM memberships WHERE organization_id=? AND user_email=?", (organization_id, actor_email)).fetchone()
        if not row or (allowed_roles and row["role"] not in allowed_roles):
            raise AuthorizationError("You do not have access to this organization")
        return str(row["role"])

    def create_project(self, organization_id: str, actor_email: str, title: str, jurisdiction: dict[str, str]) -> dict[str, Any]:
        self.authorize(organization_id, actor_email, {"org_admin", "implementation_engineer"})
        project_id, now = str(uuid4()), datetime.now(UTC).isoformat()
        with self.connection() as db:
            db.execute("INSERT INTO projects(id,organization_id,title,jurisdiction,created_at) VALUES(?,?,?,?,?)", (project_id, organization_id, title, json.dumps(jurisdiction), now))
        self.audit(organization_id, project_id, actor_email, "project.created", "project", project_id, {})
        return {"id": project_id, "organization_id": organization_id, "title": title, "jurisdiction": jurisdiction, "revision": 1, "created_at": now}

    def project(self, project_id: str, actor_email: str) -> dict[str, Any]:
        with self.connection() as db:
            row = db.execute("SELECT * FROM projects WHERE id=? AND deleted_at IS NULL", (project_id,)).fetchone()
        if not row: raise NotFoundError("Project not found")
        self.authorize(row["organization_id"], actor_email)
        result = dict(row); result["jurisdiction"] = json.loads(result["jurisdiction"])
        return result

    def add_document(self, project: dict[str, Any], actor_email: str, title: str, digest: str, storage_key: str, mime_type: str, size: int) -> dict[str, Any]:
        self.authorize(project["organization_id"], actor_email, {"org_admin", "implementation_engineer", "municipal_reviewer"})
        document_id, version_id, now = str(uuid4()), str(uuid4()), datetime.now(UTC).isoformat()
        with self.connection() as db:
            duplicate = db.execute("SELECT dv.*,d.id AS document_id,d.title FROM document_versions dv JOIN documents d ON d.id=dv.document_id WHERE d.organization_id=? AND dv.sha256=?", (project["organization_id"], digest)).fetchone()
            if duplicate: return {**dict(duplicate), "deduplicated": True}
            db.execute("INSERT INTO documents(id,organization_id,project_id,title,created_at) VALUES(?,?,?,?,?)", (document_id, project["organization_id"], project["id"], title, now))
            db.execute("INSERT INTO document_versions(id,document_id,version,sha256,storage_key,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?,?)", (version_id, document_id, 1, digest, storage_key, mime_type, size, now))
        self.audit(project["organization_id"], project["id"], actor_email, "document.uploaded", "document_version", version_id, {"mime_type": mime_type, "size_bytes": size, "sha256_prefix": digest[:12]})
        return {"id": version_id, "document_id": document_id, "version": 1, "sha256": digest, "mime_type": mime_type, "size_bytes": size, "deduplicated": False}

    def documents(self, project: dict[str, Any]) -> list[dict[str, Any]]:
        with self.connection() as db:
            rows = db.execute("SELECT d.*,dv.id AS version_id,dv.version,dv.sha256,dv.mime_type,dv.size_bytes FROM documents d JOIN document_versions dv ON dv.document_id=d.id WHERE d.project_id=? AND d.deleted_at IS NULL ORDER BY d.created_at", (project["id"],)).fetchall()
        return [dict(row) for row in rows]

    def create_analysis(self, project: dict[str, Any], actor_email: str, provider: str) -> dict[str, Any]:
        self.authorize(project["organization_id"], actor_email, {"org_admin", "implementation_engineer", "municipal_reviewer"})
        run_id, now = str(uuid4()), datetime.now(UTC).isoformat()
        with self.connection() as db:
            db.execute("INSERT INTO analysis_runs(id,organization_id,project_id,state,progress,provider,model,pipeline_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (run_id, project["organization_id"], project["id"], "queued", 0, provider, "fixture-v1" if provider == "deterministic-mock" else "configured", "0.1.0", now, now))
        self.audit(project["organization_id"], project["id"], actor_email, "analysis.started", "analysis_run", run_id, {"provider": provider})
        return self.analysis(run_id, actor_email)

    def analysis(self, run_id: str, actor_email: str) -> dict[str, Any]:
        with self.connection() as db:
            row = db.execute("SELECT * FROM analysis_runs WHERE id=?", (run_id,)).fetchone()
        if not row: raise NotFoundError("Analysis run not found")
        self.authorize(row["organization_id"], actor_email)
        return dict(row)

    def update_analysis(self, run_id: str, *, state: str, progress: int, error_code: str | None = None) -> None:
        with self.connection() as db:
            db.execute("UPDATE analysis_runs SET state=?,progress=?,error_code=?,updated_at=? WHERE id=?", (state, progress, error_code, datetime.now(UTC).isoformat(), run_id))

    def cancel_analysis(self, run_id: str, actor_email: str) -> dict[str, Any]:
        run = self.analysis(run_id, actor_email)
        with self.connection() as db: db.execute("UPDATE analysis_runs SET cancel_requested=1,updated_at=? WHERE id=?", (datetime.now(UTC).isoformat(), run_id))
        return self.analysis(run_id, actor_email)

    def audit(self, organization_id: str, project_id: str | None, actor_email: str, event_type: str, object_type: str, object_id: str, metadata: dict[str, Any], correlation_id: str | None = None) -> None:
        with self.connection() as db:
            db.execute("INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?,?,?)", (str(uuid4()), organization_id, project_id, actor_email, event_type, object_type, object_id, correlation_id or str(uuid4()), json.dumps(metadata), datetime.now(UTC).isoformat()))
