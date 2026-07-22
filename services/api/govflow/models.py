from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Origin(StrEnum):
    EXPLICIT = "explicit"
    INFERRED = "inferred"
    USER_ADDED = "user_added"
    UNKNOWN = "unknown"
    CONFLICTED = "conflicted"


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_version_id: UUID
    page_number: int = Field(ge=1)
    bbox: tuple[float, float, float, float]
    text: str = Field(min_length=1, max_length=4000)
    text_start: int = Field(ge=0)
    text_end: int = Field(ge=0)
    source_hash: str = Field(min_length=8)
    extraction_method: Literal["native_text", "acroform", "ocr", "vision", "html", "csv", "user"]

    @model_validator(mode="after")
    def validate_span(self) -> "Evidence":
        if any(value < 0 or value > 1 for value in self.bbox):
            raise ValueError("bbox coordinates must be normalized to [0, 1]")
        if self.bbox[0] > self.bbox[2] or self.bbox[1] > self.bbox[3]:
            raise ValueError("bbox must be ordered x0,y0,x1,y1")
        if self.text_end < self.text_start:
            raise ValueError("text_end must not precede text_start")
        return self


class MaterialClaim(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    kind: str
    name: str
    origin: Origin
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence]
    critical: bool = False
    qualifiers: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_evidence(self) -> "MaterialClaim":
        if self.origin in {Origin.EXPLICIT, Origin.INFERRED} and not self.evidence:
            raise ValueError("explicit and inferred claims require evidence")
        return self


class ShadowProcessNote(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    author: str = Field(min_length=2)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    description: str = Field(min_length=3)
    policy_reference: str | None = None
    duration: Literal["temporary", "permanent"]
    creates: Literal["step", "rule", "actor", "deadline", "exception"]


class WorkflowNode(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: Literal[
        "start", "applicant_form", "validation", "completeness_review", "staff_task",
        "department_review", "decision", "parallel_split", "parallel_join", "payment",
        "inspection", "timer", "notification", "public_hearing", "approval", "denial",
        "resubmission", "end",
    ]
    actor_id: str | None = None
    required: bool = True
    origin: Origin
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence]
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None
    condition: dict[str, Any] | None = None
    intentional_loop: bool = False
    loop_termination_condition: dict[str, Any] | None = None


class ReviewIssue(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    severity: Literal["informational", "warning", "blocking", "fatal"]
    issue_type: str
    detail: str
    status: Literal["open", "resolved", "dismissed"] = "open"
    object_id: str | None = None
    resolution: str | None = None


class Workflow(BaseModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    workflow_id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    title: str
    jurisdiction: dict[str, str]
    sources: list[dict[str, Any]] = Field(default_factory=list)
    actors: list[dict[str, Any]] = Field(default_factory=list)
    fields: list[dict[str, Any]] = Field(default_factory=list)
    requirements: list[dict[str, Any]] = Field(default_factory=list)
    statuses: list[dict[str, Any]] = Field(default_factory=list)
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    decision_rules: list[dict[str, Any]] = Field(default_factory=list)
    fee_rules: list[dict[str, Any]] = Field(default_factory=list)
    deadlines: list[dict[str, Any]] = Field(default_factory=list)
    issues: list[ReviewIssue] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class ProjectCreate(BaseModel):
    organization_id: UUID
    title: str = Field(min_length=2, max_length=300)
    jurisdiction: dict[str, str]


class AnalysisCreate(BaseModel):
    provider: str = "deterministic-mock"


class ConflictResolution(BaseModel):
    controlling_document_version_id: UUID
    reason: str = Field(min_length=10)


class DraftPatch(BaseModel):
    expected_revision: int = Field(ge=1)
    operations: list[dict[str, Any]]
