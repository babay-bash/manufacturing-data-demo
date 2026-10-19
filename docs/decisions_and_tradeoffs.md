# Decisions and Trade-offs

Status: proposed architecture from a working draft (2026-10-19). Items marked "open" are not decided in the source.

## Decision log

| # | Decision | Status |
|---|---|---|
| 1 | Kafka then S3 for high-frequency telemetry | Proposed |
| 2 | Snowflake as primary analytics warehouse | Proposed |
| 3 | CDC-first database integration, read-replica incremental as fallback | Proposed |
| 4 | Normalized intermediate models, conformed facts/dimensions | Proposed |
| 5 | Native Snowflake semantic views + Cortex evaluation for the MVP | Proposed |
| 6 | Snowflake Secure Data Sharing first for enterprise sources | Conditional (only where supported and useful) |
| 7 | Fivetran vs custom reusable adapters | Conditional / open |
| 8 | Storage tiers and retention periods | Conditional / open |
| 9 | Cortex Analyst vs Cortex Agents as user interface | Conditional / open |
| 10 | Durable edge gateway/local buffer | Option to validate, not committed |
| 11 | Document search / RAG | Deferred beyond day 90 |
| 12 | First-90-day priority: dashboards, analyst SQL, KPIs and AI agree on one canonical structured foundation | Decided priority |

## Trade-offs

| Decision | Chosen | Rejected alternatives | Why | Revisit when |
|---|---|---|---|---|
| Telemetry latency | Per-use-case: batch (Kafka to object storage) by default; direct Kafka only for low-latency consumers | One streaming path for everything | Cost and complexity should match the business consequence of staleness; "real-time" claims get challenged | A consumer shows stale data causes a wrong action; SLOs agreed |
| Telemetry transport | Kafka (replay, partitions, decoupling) | Managed ingestion path | Buffering under bursts and downstream failures, independent consumers | Scale is very small (managed may be cheaper to operate) |
| Loss before publish | Edge buffer kept as an option | Assuming Kafka offsets suffice | Offsets do not cover readings that never reach Kafka | Facility gateways and offline tolerance are validated |
| Duplicates | Stable event ID + idempotent sink; define uniqueness and ordering semantics | Generic business key alone | Repeat readings for the same asset/signal can both be valid | Late/out-of-order behavior measured |
| Enterprise ingestion | Ordered preference: share, events/webhooks, incremental API, bucket export, SFTP; config-driven onboarding | One technology for all sources | Source support, freshness and cost vary | Per-source answers collected |
| Build vs buy connectors | Evaluate Fivetran against custom adapters | Universal custom code | A connector platform may replace several adapters | Portfolio size, cost, drift support known |
| Database sync | CDC (Debezium, Kafka, S3, MERGE) | Scans of primary DB; timestamp-only extracts | No load on primary; captures deletes | Source lacks log access; fallback with measured lookback window (e.g. three days) |
| Warehouse | Snowflake | Databricks | Elastic compute, workload isolation, governance, zero-copy clones | Spark/lakehouse/ML needs dominate; clone storage cost grows |
| Semantic/AI layer | Snowflake semantic views + Cortex | Extra Cube + custom MCP integration | Fewer custom moving parts since warehouse is Snowflake | Cortex limits (one semantic view per eval run, multi-turn) block needs |
| Access | Identity propagated end to end; Snowflake enforces RBAC, row and column policies | Shared service account for user queries | No interface may broaden access | Governance model finalized |
| Canonical model scope | Business-question-led, incremental | Large up-front canonical model | Avoids unused modeling; ties to owned metrics | After MVP process proven |
| Documents | Defer past day 90 | Early RAG over full corpus | Relevance and version authority unproven; contradictions erode trust | Versioning scheme and authority rules established |
| Team | Three workstreams; ingestion and platform may merge | Fixed headcount | Resources unknown | Staffing known |

## Demo-specific decisions

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Local store | DuckDB file | SQLite, local Postgres | Analytical engine, no server; works with dbt adapter |
| Transformations | Real dbt CLI | Custom SQL simulating dbt | Genuine model build and tests |
| Fact design | One `fct_production_performance`, six dimensions | KPI-specific facts | Shared grain and consistent metrics |
| Ratios | Computed from sums of base numerators/denominators | Averaging row-level ratios | Ratios cannot be aggregated by averaging |
| Processing | Batch, labeled as such | "Live stream" labels | Avoids implying Kafka was deployed |
