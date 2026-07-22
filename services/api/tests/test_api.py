from __future__ import annotations

from fastapi.testclient import TestClient

from govflow import app as app_module
from govflow.store import Store


def test_tenant_isolation_upload_and_analysis(tmp_path) -> None:
    app_module.DATA_DIR = tmp_path
    app_module.OBJECT_DIR = tmp_path / "objects"
    app_module.OBJECT_DIR.mkdir()
    app_module.store = Store(tmp_path / "test.db")
    client = TestClient(app_module.app)

    alpha_headers = {"x-user-email": "alpha@example.gov"}
    beta_headers = {"x-user-email": "beta@example.gov"}
    alpha_org = client.post("/organizations", json={"name": "Alpha City"}, headers=alpha_headers).json()
    beta_org = client.post("/organizations", json={"name": "Beta City"}, headers=beta_headers).json()
    alpha_project = client.post("/projects", json={"organization_id": alpha_org["id"], "title": "Building Permit", "jurisdiction": {"name": "Alpha City", "country": "US"}}, headers=alpha_headers).json()

    assert client.get(f"/projects/{alpha_project['id']}", headers=beta_headers).status_code == 404
    assert client.post("/projects", json={"organization_id": beta_org["id"], "title": "Beta Permit", "jurisdiction": {"name": "Beta City", "country": "US"}}, headers=beta_headers).status_code == 201

    pdf = b"%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"
    upload = client.post(f"/projects/{alpha_project['id']}/documents", files={"file": ("permit.pdf", pdf, "application/pdf")}, headers=alpha_headers)
    assert upload.status_code == 201
    assert upload.json()["sha256"]
    duplicate = client.post(f"/projects/{alpha_project['id']}/documents", files={"file": ("copy.pdf", pdf, "application/pdf")}, headers=alpha_headers)
    assert duplicate.status_code == 201 and duplicate.json()["deduplicated"] is True

    note = client.post(f"/projects/{alpha_project['id']}/shadow-notes", json={"author": "A. Reviewer", "description": "Planning desk checks the project address before fee collection.", "duration": "permanent", "creates": "step"}, headers=alpha_headers)
    assert note.status_code == 201 and note.json()["origin"] == "user_added"

    run = client.post(f"/projects/{alpha_project['id']}/analysis-runs", json={"provider": "deterministic-mock"}, headers=alpha_headers)
    assert run.status_code == 202
    status = client.get(f"/analysis-runs/{run.json()['id']}", headers=alpha_headers)
    assert status.status_code == 200
