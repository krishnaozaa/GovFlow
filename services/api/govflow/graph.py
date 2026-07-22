from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Iterable

from .models import ReviewIssue, WorkflowEdge, WorkflowNode


@dataclass(frozen=True)
class ValidationReport:
    valid: bool
    errors: tuple[str, ...]
    blockers: tuple[str, ...]


def validate_graph(nodes: Iterable[WorkflowNode], edges: Iterable[WorkflowEdge], issues: Iterable[ReviewIssue] = ()) -> ValidationReport:
    node_list, edge_list = list(nodes), list(edges)
    errors: list[str] = []
    ids = {node.id for node in node_list}
    starts = [node for node in node_list if node.kind == "start"]
    terminals = [node for node in node_list if node.kind in {"end", "approval", "denial"}]
    if len(starts) != 1: errors.append("Workflow must contain exactly one start node")
    if not terminals: errors.append("Workflow must contain at least one terminal node")
    outgoing: dict[str, list[WorkflowEdge]] = defaultdict(list)
    incoming: dict[str, list[WorkflowEdge]] = defaultdict(list)
    for edge in edge_list:
        if edge.source not in ids or edge.target not in ids:
            errors.append(f"Dangling edge: {edge.id}")
            continue
        outgoing[edge.source].append(edge)
        incoming[edge.target].append(edge)
        if edge.intentional_loop and not edge.loop_termination_condition:
            errors.append(f"Intentional loop {edge.id} has no termination condition")
    for node in node_list:
        if node.kind not in {"end", "approval", "denial"} and not outgoing[node.id]:
            errors.append(f"Nonterminal node has no outgoing path: {node.id}")
        if node.kind == "decision":
            labels = [edge.label for edge in outgoing[node.id]]
            if len(labels) < 2 or any(not label for label in labels): errors.append(f"Decision has incomplete branches: {node.id}")
            if len(labels) != len(set(labels)): errors.append(f"Decision branch labels are not unique: {node.id}")
        if node.actor_id is None and node.kind not in {"start", "end", "parallel_split", "parallel_join", "decision"}:
            errors.append(f"Required actor assignment is missing: {node.id}")
        if node.origin.value in {"explicit", "inferred"} and not node.evidence:
            errors.append(f"Extracted node has no evidence: {node.id}")
    if starts:
        reachable, queue = set(), deque([starts[0].id])
        while queue:
            current = queue.popleft()
            if current in reachable: continue
            reachable.add(current)
            queue.extend(edge.target for edge in outgoing[current])
        for node in node_list:
            if node.required and node.id not in reachable: errors.append(f"Required node is unreachable: {node.id}")
    blockers = [issue.detail for issue in issues if issue.status == "open" and issue.severity in {"blocking", "fatal"}]
    return ValidationReport(not errors and not blockers, tuple(dict.fromkeys(errors)), tuple(blockers))
