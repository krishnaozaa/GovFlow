# ADR 0003: Safe rule AST

**Status:** accepted

Conditions use a closed, typed AST of logical, comparison, reference, and bounded string operators. Missing references or incompatible values fail closed and produce review issues. Arbitrary expressions, `eval`, generated SQL, and document-provided code are prohibited.
