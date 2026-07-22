from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest

from govflow.graph import validate_graph
from govflow.ingestion import IngestionError, inspect_magic, normalize_bbox, score_text_quality, validate_source_url
from govflow.models import Evidence, Origin, ReviewIssue, WorkflowEdge, WorkflowNode
from govflow.rules import RuleError, calculate_fee, evaluate_rule, render_rule


def evidence() -> Evidence:
    return Evidence(document_version_id=uuid4(), page_number=1, bbox=(0.1, 0.2, 0.8, 0.4), text="Application must include a site plan.", text_start=10, text_end=47, source_hash="sha256:test", extraction_method="native_text")


def test_file_signature_and_spoofing() -> None:
    assert inspect_magic("permit.pdf", "application/pdf", b"%PDF-1.7\ncontent") == "application/pdf"
    assert inspect_magic("fees.csv", "text/csv", b"name,amount\nreview,500") == "text/csv"
    with pytest.raises(IngestionError, match="do not match"):
        inspect_magic("malware.pdf", "application/pdf", b"not a pdf")
    with pytest.raises(IngestionError, match="Only PDF and CSV"):
        inspect_magic("payload.svg", "image/svg+xml", b"<svg onload='x()'/>")


def test_normalized_bbox_is_clamped() -> None:
    assert normalize_bbox((-5, 20, 500, 220), 400, 200) == (0.0, 0.1, 1.0, 1.0)
    with pytest.raises(ValueError): normalize_bbox((0, 0, 1, 1), 0, 100)


def test_page_quality_uses_ocr_selectively() -> None:
    native = score_text_quality("A" * 500, 1000, 600, 50)
    scanned = score_text_quality("", 1000, 0, 900)
    assert native.needs_ocr is False
    assert scanned.needs_ocr is True
    assert native.character_count == 500


@pytest.mark.parametrize("url", ["file:///etc/passwd", "http://localhost/admin", "http://127.0.0.1/latest/meta-data", "http://169.254.169.254/latest/meta-data"])
def test_url_safety_blocks_local_and_metadata(url: str) -> None:
    def resolver(*_args, **_kwargs): return [(2, 1, 6, "", (url.split("//")[-1].split("/")[0], 80))]
    with pytest.raises(IngestionError): validate_source_url(url, resolver=resolver)


def test_dns_rebinding_defense_rejects_any_private_result() -> None:
    def resolver(*_args, **_kwargs):
        return [(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("10.0.0.5", 443))]
    with pytest.raises(IngestionError, match="private"):
        validate_source_url("https://example.gov/source", resolver=resolver)


def test_rule_interpreter_and_unknown_reference_fail_closed() -> None:
    expression = {"op": "all", "args": [
        {"op": "greater_than", "left": {"ref": "fields.square_feet"}, "right": {"literal": 10000}},
        {"op": "equal", "left": {"ref": "fields.occupancy"}, "right": {"literal": "commercial"}},
    ]}
    assert evaluate_rule(expression, {"fields": {"square_feet": 10001, "occupancy": "commercial"}}).value is True
    with pytest.raises(RuleError, match="Unresolved reference"):
        evaluate_rule(expression, {"fields": {"occupancy": "commercial"}})


def test_fee_math_is_decimal_and_boundary_exact() -> None:
    expression = {"op": "max", "args": [
        {"literal": "500.00"},
        {"op": "multiply", "args": [{"ref": "fields.square_feet"}, {"literal": "0.25"}]},
    ]}
    assert calculate_fee(expression, {"fields": {"square_feet": Decimal("1999")}}) == 50000
    assert calculate_fee(expression, {"fields": {"square_feet": Decimal("2000")}}) == 50000
    assert calculate_fee(expression, {"fields": {"square_feet": Decimal("2001")}}) == 50025
    assert calculate_fee(expression, {"fields": {"square_feet": Decimal("2001")}}) == 50025
    assert "max(" in render_rule(expression)
    with pytest.raises(RuleError): calculate_fee({"literal": "-1"}, {})


def test_graph_validation_and_publication_blockers() -> None:
    ev = evidence()
    nodes = [
        WorkflowNode(id="start", name="Start", kind="start", origin=Origin.EXPLICIT, confidence=1, evidence=[ev]),
        WorkflowNode(id="decision", name="Complete?", kind="decision", origin=Origin.EXPLICIT, confidence=.9, evidence=[ev]),
        WorkflowNode(id="approve", name="Approve", kind="approval", actor_id="official", origin=Origin.EXPLICIT, confidence=1, evidence=[ev]),
        WorkflowNode(id="deny", name="Deny", kind="denial", actor_id="official", origin=Origin.EXPLICIT, confidence=1, evidence=[ev]),
    ]
    edges = [WorkflowEdge(id="a", source="start", target="decision"), WorkflowEdge(id="b", source="decision", target="approve", label="Yes"), WorkflowEdge(id="c", source="decision", target="deny", label="No")]
    assert validate_graph(nodes, edges).valid
    issue = ReviewIssue(severity="fatal", issue_type="conflict", detail="Fee sources disagree")
    report = validate_graph(nodes, edges, [issue])
    assert not report.valid and report.blockers == ("Fee sources disagree",)


def test_evidence_requires_normalized_coordinates() -> None:
    with pytest.raises(ValueError, match="normalized"):
        Evidence(document_version_id=uuid4(), page_number=1, bbox=(0, 0, 200, 400), text="Source", text_start=0, text_end=6, source_hash="sha256:test", extraction_method="ocr")
