# ADR 0009: Tenant authorization

**Status:** accepted

Every persistent object belongs directly or indirectly to an organization. API repositories resolve ownership and membership before returning data; the frontend is never an authorization boundary. Cross-tenant misses and guesses return the same safe `404` shape. Roles are `org_admin`, `implementation_engineer`, `municipal_reviewer`, and `viewer`.
