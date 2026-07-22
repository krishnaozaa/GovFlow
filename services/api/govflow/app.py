from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .ingestion import IngestionError, inspect_magic, safe_internal_name, sha256_bytes
from .models import AnalysisCreate, OrganizationCreate, ProjectCreate, ShadowProcessNote
from .store import AuthorizationError, NotFoundError, Store


DATA_DIR = Path(os.environ.get("GOVFLOW_DATA_DIR", "/tmp/govflow-data")).resolve()
OBJECT_DIR = DATA_DIR / "objects"
OBJECT_DIR.mkdir(parents=True, exist_ok=True)
store = Store(DATA_DIR / "govflow.db")
app = FastAPI(title="GovFlow API", version="0.1.0", docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("GOVFLOW_ALLOWED_ORIGINS", "http://localhost:3000").split(","), allow_methods=["GET", "POST", "PATCH"], allow_headers=["authorization", "content-type", "idempotency-key", "x-user-email", "x-request-id"])


def actor(x_user_email: Annotated[str | None, Header()] = None) -> str:
    return x_user_email or "demo.engineer@govflow.local"


@app.exception_handler(NotFoundError)
async def not_found(_: Request, exc: NotFoundError):
    return _error(404, "not_found", str(exc))


@app.exception_handler(AuthorizationError)
async def forbidden(_: Request, exc: AuthorizationError):
    return _error(404, "not_found", "Resource not found")


@app.exception_handler(IngestionError)
async def invalid_upload(_: Request, exc: IngestionError):
    return _error(422, "invalid_source", str(exc))


def _error(status: int, code: str, message: str):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok", "pipeline_version": "0.1.0"}


@app.post("/organizations", status_code=201)
def create_organization(payload: OrganizationCreate, user: Annotated[str, Depends(actor)]) -> dict[str, Any]:
    return store.create_organization(payload.name, user)


@app.post("/projects", status_code=201)
def create_project(payload: ProjectCreate, user: Annotated[str, Depends(actor)]) -> dict[str, Any]:
    return store.create_project(str(payload.organization_id), user, payload.title, payload.jurisdiction)


@app.get("/projects/{project_id}")
def get_project(project_id: UUID, user: Annotated[str, Depends(actor)]) -> dict[str, Any]:
    return store.project(str(project_id), user)


@app.get("/projects/{project_id}/sources")
def list_sources(project_id: UUID, user: Annotated[str, Depends(actor)]) -> list[dict[str, Any]]:
    return store.documents(store.project(str(project_id), user))


@app.post("/projects/{project_id}/documents", status_code=201)
async def upload_document(project_id: UUID, user: Annotated[str, Depends(actor)], file: Annotated[UploadFile, File()]) -> dict[str, Any]:
    project = store.project(str(project_id), user)
    data = await file.read(25 * 1024 * 1024 + 1)
    mime_type = inspect_magic(file.filename or "upload", file.content_type, data)
    digest = sha256_bytes(data)
    organization_dir = OBJECT_DIR / project["organization_id"]
    organization_dir.mkdir(parents=True, exist_ok=True)
    storage_path = organization_dir / safe_internal_name(file.filename or "upload", digest)
    storage_path.write_bytes(data)
    return store.add_document(project, user, file.filename or "Untitled source", digest, str(storage_path.relative_to(DATA_DIR)), mime_type, len(data))


@app.post("/projects/{project_id}/shadow-notes", status_code=201)
def create_shadow_note(project_id: UUID, payload: ShadowProcessNote, user: Annotated[str, Depends(actor)]) -> dict[str, Any]:
    project = store.project(str(project_id), user)
    store.authorize(project["organization_id"], user, {"org_admin", "implementation_engineer", "municipal_reviewer"})
    with store.connection() as db:
        db.execute("INSERT INTO shadow_notes VALUES(?,?,?,?,?,?,?,?,?)", (str(payload.id), project["organization_id"], project["id"], payload.author, payload.recorded_at.isoformat(), payload.description, payload.policy_reference, payload.duration, payload.creates))
    store.audit(project["organization_id"], project["id"], user, "shadow_note.created", "shadow_note", str(payload.id), {"duration": payload.duration, "creates": payload.creates})
    return {**payload.model_dump(mode="json"), "origin": "user_added"}


async def run_analysis(run_id: str) -> None:
    for state, progress in (("inspecting", 15), ("normalizing", 35), ("extracting", 65), ("reconciling", 82), ("compiling", 95), ("complete", 100)):
        await asyncio.sleep(0.08)
        with store.connection() as db:
            row = db.execute("SELECT cancel_requested FROM analysis_runs WHERE id=?", (run_id,)).fetchone()
        if row and row["cancel_requested"]:
            store.update_analysis(run_id, state="cancelled", progress=progress)
            return
        store.update_analysis(run_id, state=state, progress=progress)


@app.post("/projects/{project_id}/analysis-runs", status_code=202)
def start_analysis(project_id: UUID, payload: AnalysisCreate, background: BackgroundTasks, user: Annotated[str, Depends(actor)]) -> dict[str, Any]:
    run = store.create_analysis(store.project(str(project_id), user), user, payload.provider)
    background.add_task(run_analysis, run["id"])
    return run


@app.get("/analysis-runs/{run_id}")
def get_analysis(run_id: UUID, user: Annotated[str, Depends(actor)]) -> dict[str, Any]: return store.analysis(str(run_id), user)


@app.post("/analysis-runs/{run_id}/cancel")
def cancel_analysis(run_id: UUID, user: Annotated[str, Depends(actor)]) -> dict[str, Any]: return store.cancel_analysis(str(run_id), user)


@app.get("/analysis-runs/{run_id}/events")
async def analysis_events(run_id: UUID, user: Annotated[str, Depends(actor)]) -> StreamingResponse:
    async def events():
        previous = None
        while True:
            current = store.analysis(str(run_id), user)
            marker = (current["state"], current["progress"])
            if marker != previous:
                yield f"event: progress\ndata: {json.dumps({'state': marker[0], 'progress': marker[1]})}\n\n"
                previous = marker
            if current["state"] in {"complete", "failed", "cancelled"}: break
            await asyncio.sleep(0.25)
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
