from __future__ import annotations

import hashlib
import ipaddress
import re
import socket
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse


class IngestionError(ValueError):
    """Safe, actionable upload or source-ingestion error."""


ALLOWED_EXTENSIONS = {".pdf": "application/pdf", ".csv": "text/csv"}
PDF_MAGIC = b"%PDF-"
MAX_BYTES = 25 * 1024 * 1024


@dataclass(frozen=True)
class QualitySignals:
    character_count: int
    text_coverage: float
    replacement_character_ratio: float
    suspicious_whitespace_ratio: float
    image_to_text_ratio: float
    rotation: int
    needs_ocr: bool


def inspect_magic(filename: str, content_type: str | None, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise IngestionError("Only PDF and CSV files are supported")
    if len(data) > MAX_BYTES:
        raise IngestionError(f"Document exceeds the {MAX_BYTES // 1024 // 1024} MB limit")
    if not data:
        raise IngestionError("Document is empty")
    expected = ALLOWED_EXTENSIONS[suffix]
    if suffix == ".pdf" and not data.startswith(PDF_MAGIC):
        raise IngestionError("File extension and content do not match: expected a PDF")
    if suffix == ".csv":
        sample = data[:8192]
        if b"\x00" in sample or not any(separator in sample for separator in (b",", b";", b"\t")):
            raise IngestionError("File extension and content do not match: expected delimited text")
        try:
            sample.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise IngestionError("CSV must use UTF-8 encoding") from exc
    if content_type and content_type not in {expected, "application/octet-stream", "text/plain", "application/vnd.ms-excel"}:
        raise IngestionError("Declared content type does not match the uploaded file")
    return expected


def safe_internal_name(original_name: str, digest: str) -> str:
    suffix = Path(original_name).suffix.lower()
    return f"{digest[:24]}{suffix}"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_bbox(bbox: tuple[float, float, float, float], width: float, height: float) -> tuple[float, float, float, float]:
    if width <= 0 or height <= 0:
        raise ValueError("page dimensions must be positive")
    x0, y0, x1, y1 = bbox
    normalized = (x0 / width, y0 / height, x1 / width, y1 / height)
    return tuple(round(min(1.0, max(0.0, value)), 6) for value in normalized)  # type: ignore[return-value]


def score_text_quality(text: str, page_area: float, text_area: float, image_area: float, rotation: int = 0) -> QualitySignals:
    characters = len(text)
    replacements = text.count("\ufffd")
    whitespace_runs = sum(len(match.group(0)) for match in re.finditer(r"[ \t]{5,}", text))
    coverage = 0 if page_area <= 0 else min(1, max(0, text_area / page_area))
    image_ratio = 0 if text_area <= 0 else image_area / text_area
    replacement_ratio = replacements / max(1, characters)
    whitespace_ratio = whitespace_runs / max(1, characters)
    needs_ocr = characters < 40 or coverage < 0.01 or replacement_ratio > 0.03 or image_ratio > 12
    return QualitySignals(characters, round(coverage, 6), round(replacement_ratio, 6), round(whitespace_ratio, 6), round(image_ratio, 6), rotation % 360, needs_ocr)


def is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified)


def validate_source_url(url: str, resolver=socket.getaddrinfo) -> tuple[str, list[str]]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise IngestionError("Web sources must use HTTP or HTTPS")
    if not parsed.hostname or parsed.username or parsed.password:
        raise IngestionError("Web source URL is invalid")
    if parsed.hostname.lower() in {"localhost", "localhost.localdomain"}:
        raise IngestionError("Local and private network addresses are not allowed")
    try:
        addresses = sorted({item[4][0] for item in resolver(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)})
    except socket.gaierror as exc:
        raise IngestionError("Web source hostname could not be resolved") from exc
    if not addresses or any(not is_public_ip(address) for address in addresses):
        raise IngestionError("Local, private, link-local, and metadata addresses are not allowed")
    return parsed.geturl(), addresses


def quality_dict(signals: QualitySignals) -> dict[str, object]:
    return asdict(signals)
