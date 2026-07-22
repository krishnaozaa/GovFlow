# ADR 0005: Hybrid page extraction

**Status:** accepted

Inspect each page independently. Prefer native text/layout and AcroForm data, calculate quality signals, and OCR only weak pages. PyMuPDF/local parsing owns page coordinates; vision interpretation cannot be the sole provenance source.
