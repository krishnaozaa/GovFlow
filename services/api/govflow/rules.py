from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_DOWN, ROUND_HALF_EVEN, ROUND_HALF_UP, ROUND_UP
from typing import Any, Mapping


class RuleError(ValueError):
    """A rule is invalid or cannot be evaluated safely."""


@dataclass(frozen=True)
class EvaluationResult:
    value: Any
    trace: tuple[str, ...]


def _resolve(node: Mapping[str, Any], context: Mapping[str, Any], trace: list[str]) -> Any:
    if "literal" in node:
        return node["literal"]
    if "literal_minor_units" in node:
        return Decimal(node["literal_minor_units"]) / Decimal(100)
    if "ref" in node:
        ref = node["ref"]
        current: Any = context
        for part in ref.split("."):
            if not isinstance(current, Mapping) or part not in current:
                raise RuleError(f"Unresolved reference: {ref}")
            current = current[part]
        trace.append(ref)
        return current
    return _evaluate(node, context, trace)


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise RuleError("Expected a decimal-compatible value") from exc


def _evaluate(node: Mapping[str, Any], context: Mapping[str, Any], trace: list[str]) -> Any:
    if not isinstance(node, Mapping):
        raise RuleError("Rule node must be an object")
    if "literal" in node or "literal_minor_units" in node or "ref" in node:
        return _resolve(node, context, trace)
    op = node.get("op")
    if op == "if":
        condition = bool(_resolve(node.get("condition", {}), context, trace))
        return _resolve(node.get("then" if condition else "else", {}), context, trace)
    args = node.get("args")
    if op in {"all", "any", "not", "add", "subtract", "multiply", "divide", "min", "max"}:
        if not isinstance(args, list) or not args:
            raise RuleError(f"{op} requires at least one argument")
        values = [_resolve(arg, context, trace) for arg in args]
        if op == "all": return all(bool(value) for value in values)
        if op == "any": return any(bool(value) for value in values)
        if op == "not":
            if len(values) != 1: raise RuleError("not requires one argument")
            return not bool(values[0])
        decimals = [_decimal(value) for value in values]
        if op == "add": return sum(decimals, Decimal(0))
        if op == "subtract":
            if len(decimals) != 2: raise RuleError("subtract requires two arguments")
            return decimals[0] - decimals[1]
        if op == "multiply":
            result = Decimal(1)
            for value in decimals: result *= value
            return result
        if op == "divide":
            if len(decimals) != 2 or decimals[1] == 0: raise RuleError("invalid division")
            return decimals[0] / decimals[1]
        return (min if op == "min" else max)(decimals)
    if "left" not in node:
        raise RuleError(f"Unsupported operator: {op}")
    left = _resolve(node["left"], context, trace)
    if op == "exists": return left is not None
    if op == "is_empty": return left is None or left == "" or left == []
    if "right" not in node: raise RuleError(f"{op} requires a right operand")
    right = _resolve(node["right"], context, trace)
    if op == "equal": return left == right
    if op == "not_equal": return left != right
    if op == "greater_than": return left > right
    if op == "greater_than_or_equal": return left >= right
    if op == "less_than": return left < right
    if op == "less_than_or_equal": return left <= right
    if op == "in": return left in right
    if op == "not_in": return left not in right
    if op == "contains": return right in left
    if op == "starts_with": return isinstance(left, str) and left.startswith(str(right))
    if op == "ends_with": return isinstance(left, str) and left.endswith(str(right))
    if op == "matches":
        pattern = str(right)
        if len(pattern) > 256 or len(str(left)) > 4096: raise RuleError("regular expression input exceeds limits")
        if re.search(r"(\+|\*|\{\d+,?\d*\})(?:[^)]{0,12})(\+|\*|\{\d+,?\d*\})", pattern):
            raise RuleError("potentially unsafe regular expression")
        return re.search(pattern, str(left)) is not None
    raise RuleError(f"Unsupported operator: {op}")


def evaluate_rule(expression: Mapping[str, Any], context: Mapping[str, Any]) -> EvaluationResult:
    trace: list[str] = []
    return EvaluationResult(_evaluate(expression, context, trace), tuple(trace))


ROUNDING = {"half_up": ROUND_HALF_UP, "half_even": ROUND_HALF_EVEN, "up": ROUND_UP, "down": ROUND_DOWN}


def calculate_fee(expression: Mapping[str, Any], context: Mapping[str, Any], rounding: str = "half_up") -> int:
    if rounding not in ROUNDING: raise RuleError("Unsupported monetary rounding mode")
    value = _decimal(evaluate_rule(expression, context).value)
    if value < 0: raise RuleError("A calculated fee cannot be negative")
    quantized = value.quantize(Decimal("0.01"), rounding=ROUNDING[rounding])
    return int(quantized * 100)


def render_rule(expression: Mapping[str, Any]) -> str:
    if "literal" in expression: return repr(expression["literal"])
    if "literal_minor_units" in expression: return f"${Decimal(expression['literal_minor_units']) / Decimal(100):.2f}"
    if "ref" in expression: return str(expression["ref"])
    op = expression.get("op", "unknown")
    if op == "if": return f"if {render_rule(expression['condition'])}, then {render_rule(expression['then'])}, otherwise {render_rule(expression['else'])}"
    args = expression.get("args")
    if args: return f"{op}({', '.join(render_rule(arg) for arg in args)})"
    return f"{render_rule(expression['left'])} {op.replace('_', ' ')} {render_rule(expression['right']) if 'right' in expression else ''}".strip()
