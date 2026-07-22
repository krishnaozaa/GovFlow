# ADR 0002: Graph representation

**Status:** accepted

Store typed nodes and directed edges with stable IDs and persisted layout. React Flow edits this graph; Mermaid is generated only for export. Intentional cycles require an explicit termination condition.
