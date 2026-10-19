# AI Assistance Disclosure

## Architecture proposal
AI helped organize and edit the write-up and challenge trade-offs. The priorities and final choices
are the author's.

## Demo code
The demo repository was implemented with Claude Code from the author's written specification and reviewed by the author.

## Where the author's decisions shaped or overrode AI suggestions
Taken from the working draft's "user's decisions / choices" markers:

| Topic | AI-raised point | Author's decision |
|---|---|---|
| Offline telemetry | AI challenged that Kafka offsets do not prevent loss before publication | Author kept a durable edge gateway/local buffer only as an option to validate, not an assumed capability; not expanded further |
| Latency | Generic "real-time" framing | Author: start from the business consumer, challenge asserted real-time needs; batch path by default, direct Kafka only for ML/automated workflows |
| Observability | Tooling options | Author chose Prometheus + Grafana (prior experience); Monte Carlo or Great Expectations for freshness/volume; dbt tests for transformed data |
| Team split | Headcount assumptions | Author chose three workstreams (ingestion, platform, business-embedded analytics engineering, which also owns AI-answer evaluation); no headcount assumed |
| Documents / RAG | Earlier inclusion | Author deferred document search past day 90 until version authority is established |
| Identity | Shared service account patterns | Author required end-to-end user identity with Snowflake as the enforcement point |
| Client questions | Assistant-suggested set | Author selects questions; items 4-5 not yet chosen |
| Compression | Estimate | Author's 2-5x figure is an unvalidated estimate |

## TODO for the author (fill in before submission)
- [ ] List specific AI suggestions you rejected or rewrote in the final text (the source draft does not record these).
- [ ] State which sections were edited by hand after AI structuring.
- [ ] List any demo-code decisions you changed after reviewing Claude Code's output.
- [ ] Confirm the tools used (Notion AI vs Claude) per section.

## Demo implementation: choices made by Claude Code (for the author to confirm)
Claude Code implemented the demo from the Notion brief. These implementation decisions were made by
the agent, not by the brief, and are listed for review:
- **Blue/green promotion** of the DuckDB file (build → serving copy only after all dbt tests pass). The
  brief only required "never leave stale outputs looking fresh".
- **UI rebuilt in React + TypeScript** (prebuilt, committed `web/dist`) over a thin FastAPI layer, so dbt stays real.
- **KPI definitions stored once in `dbt_project.yml` vars**, shared by the dbt macro and the dashboard,
  instead of a dbt semantic layer / MetricFlow, which is heavier and not supported on DuckDB here.
- **Snapshot-replace raw loads** (each landed file is a complete snapshot), rather than append + merge.
- **Bad-quality energy readings are quarantined, not imputed.** Energy is slightly undercounted, and the
  count is shown per operation.
- **Late-arrival flag uses the latest delivery** (dedup keeps the latest ingestion), so re-delivered
  events count as late (2,988 vs 1,800 injected late events).
- **Natural keys** in dimensions instead of surrogate keys (static master data).
- **Packaging:** python-build-standalone CPython 3.12 from uv plus hash-locked wheels, unsigned. The
  launcher clears the quarantine flag on its own folder. Apple Silicon only. Intel not built.
- Facility/line/machine/product names, rates and volumes are invented.
