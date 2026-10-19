# Demo decisions and trade-offs

The **architecture** trade-offs (focused MVP, reuse Snowflake/Databricks, raw archive, selective
Iceberg, shared definitions, measured AI evaluations, deferred RAG) are in
[`design.md`](design.md#choices-and-tradeoffs). This file covers decisions made for the **local
demo** only.

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Local store | DuckDB file | SQLite, local Postgres | Analytical engine, no server, supported dbt adapter |
| Transformations | Real dbt CLI (dbt-core 1.10 + dbt-duckdb) | Custom SQL simulating dbt | Genuine model build and tests, the same tool as production |
| Fact design | One `fct_production_performance`, six dimensions | KPI-specific facts | Shared grain and consistent metrics |
| Ratios | Computed from sums of base numerators and denominators | Averaging row-level ratios | Ratios cannot be aggregated by averaging |
| Metric definitions | Once, in `dbt_project.yml` vars, used by dbt + API | dbt Semantic Layer / MetricFlow | Not available on DuckDB locally; same idea at demo scale |
| Raw load | Snapshot replace per landed file | Append + merge | Landed files are complete snapshots; dedup on stable keys happens in dbt anyway |
| Bad sensor readings | Quarantined with reason, counted | Imputed | Never invent data silently; the undercount is visible |
| Promotion | Blue/green copy of the DuckDB file after all tests pass | Build in place | A failed run never leaves half-built tables being served |
| Processing | Batch, labeled as such | "Live stream" labels | Avoids implying Kafka was deployed |
| UI | React + TypeScript (prebuilt) over FastAPI | Streamlit; all-TypeScript without dbt | Modern UI without dropping real dbt; reviewers never need Node |
| Distribution | Bundled CPython + locked wheels, unsigned | Docker, pip install at startup | One command, offline, no prerequisites; signing needs a Developer ID |
