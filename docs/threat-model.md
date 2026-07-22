# Threat model

Assets include source documents, extracted personal information, organization membership, review decisions, published workflows, model credentials, and signed storage access. Adversaries include malicious uploaders, cross-tenant users, compromised webpages, prompt-injection authors, and opportunistic network attackers.

Primary controls:

- Upload allowlists, magic-byte checks, size/page limits, generated names, object isolation, and a malware-scanner adapter boundary.
- URL scheme, DNS, redirect, content-type, timeout, and response-size validation; localhost, private, link-local, reserved, and metadata networks are denied before and after redirects.
- Document content is untrusted data. It cannot execute, request tools, alter system instructions, or receive secrets.
- Tenant authorization occurs for every project-derived object. Unauthorized and absent objects share safe `404` behavior.
- Rule and fee text cannot become Python, JavaScript, SQL, or regular expressions without bounded validation.
- Logs contain request/job/tenant identifiers and safe metadata, never document bodies, complete page text, tokens, keys, or signed URLs.
- Published versions, source versions after analysis, and security-sensitive audit events are immutable.
- Soft deletion precedes scheduled hard deletion; storage lifecycle and backups honor the documented retention lag.

Residual risks include OCR mistakes, visually ambiguous controls, malicious-but-valid PDFs exploiting parsing libraries, upstream model behavior changes, and reviewer selection of an incorrect controlling source. Sandboxed workers, dependency updates, explicit evidence, test fixtures, and human publication gates reduce but do not eliminate these risks.
