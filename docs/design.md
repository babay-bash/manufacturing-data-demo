# Production Architecture Design

Proposed design from a working draft dated 2026-10-19; not a final decision. The local demo is a small illustration of this design, not a scaled-down production system (see `local-flow.mmd`).

## Scenario and assumed context
Global industrial manufacturing and service. Sources: high-frequency telemetry from plant/field assets; ERP, MES, QMS, CRM and SaaS systems; operational and acquired databases. Pain points: one-off pipelines and competing KPI gold tables; unstructured service manuals, engineering change notices, quality investigations and support tickets.

Sizing, SLAs, peak load, residency, retention rules and budget are unknown; they are open questions below, not assumptions.

## Objectives and decision principles
1. First priority: structured data is the single source of truth for dashboards, analysts, KPIs and AI answers, all grounded in the same canonical entities, facts, conformed dimensions and metric definitions.
2. Reusable integration patterns, incremental rollout, clear ownership, measurable AI answer accuracy.
3. Second priority, after day 90: unstructured document search, once relevance, currency and version authority can be established.

## Source integration patterns

### Telemetry
Devices or gateways emit events (asset ID, signal name, event timestamp, reading, unit, quality/status, schema version, unique event ID) to an authenticated endpoint, which publishes to Kafka; an S3 sink persists raw telemetry. Ingestion timestamp is captured alongside event timestamp.

- Why Kafka: ecosystem, partitions, retention-backed buffering, replay, independent consumers.
- Kafka alone does not guarantee zero loss. Needs producer acks, replication, offset management, retries, idempotent sink writes, replay tests.
- Offline sensors: local edge buffering, clock skew, backpressure. A durable gateway is an option to validate, not an assumed capability.
- Very small scale: a managed ingestion path may be cheaper than operating Kafka.

### Enterprise systems (ranked, per source)
| Rank | Pattern | Note |
|---|---|---|
| 1 | Snowflake Secure Data Sharing | No extra copy; freshness depends on provider |
| 2 | Source change events / webhooks | Replay and delivery contracts |
| 3 | Incremental APIs | Pagination, rate limits, stable IDs, reliable cursors |
| 4 | Scheduled bucket exports | Arrival notifications, automated load |
| 5 | SFTP | When nothing better exists |

Evaluate Fivetran where portfolio breadth, cost, freshness and drift support justify it. Onboarding is configuration-driven (secrets, schedule, rate limit, cursor, schema contract, raw prefix, owner, monitoring, reprocessing); custom code only for source-specific behavior.

### Operational databases / CDC
Preferred: log-based CDC (Debezium to Kafka to S3), immutable change records, ordered incremental MERGE; requires snapshot bootstrap, stable keys, ordering, schema evolution, resnapshot/reconciliation. Fallback: read-replica extracts with updated-at timestamps and key upserts; without reliable markers, a measured lookback window (for example three days) chosen from observed late arrival. Timestamp windows cannot detect hard deletes or very old corrections without tombstones, soft-delete markers or reconciliation.

## Streaming vs batch and latency
Start from the consumer, not the technology. Low-latency ML features or automated workflows can read Kafka directly; analytics without a real-time need use Kafka to object storage to batch. Ask what decision is taken, when, and what changes with newer data; challenge asserted "real-time" requirements. Numeric freshness SLOs are not set and must be agreed with stakeholders.

Recovery and duplicates: offsets help only after records reach Kafka. Use stable event IDs, acknowledgments and idempotent sinks; define uniqueness and event-time ordering so genuine duplicates are distinguished from valid repeat readings.

## Data contracts and quality
- Schema contract per source; schema version in every telemetry event.
- dbt tests on transformed data; source-to-target comparison for database-sourced tables; null-rate and duplicate checks on business keys.
- Anomaly detection on final business metrics (learned-pattern, optionally by dimension).
- Data tests run alongside AI tests: correct SQL over incorrect data is not a correct answer.

## Warehouse, modeling and grain
Snowflake: elastic compute separate from storage, workload isolation, governance, zero-copy cloning (copy-on-write; changed partitions and long retention cost money). Databricks remains credible where Spark/ML dominates.

| Layer | Purpose |
|---|---|
| Raw / bronze | Source fidelity, ingestion metadata, immutable |
| Standardized / silver | Names, types, time zones, units, codes; validate; dedupe; map to common keys |
| Conformed / gold | Shared dimensions (supplier, customer, asset, facility); facts with explicit grain |
| Semantic | Measures, dimensions, synonyms, descriptions, filters, owners |

Identity resolution via a crosswalk from source system and natural key to a governed universal ID, with deterministic matching, conflict handling and stewardship. SCD policy is an open question.

## Canonical metrics and semantic layer (shared by SQL, BI, AI)
Start from business questions; declare fact grain, numerator/denominator, time and status rules, and an accountable owner. Genuine KPI variants are named and documented, never silently redefined. Dashboards, analyst SQL, KPI computation and AI answers all read the same semantic views.

## Governance, identity and access
- Separate data-access roles from functional roles; consumers read gold.
- Ask business questions (who sees what, which facilities isolated, which fields sensitive), then implement row policies and column masking.
- The requester's identity is preserved through BI, SQL or AI agent; Snowflake is the enforcement point. No shared service account with broader rights than the user. The author has implemented this pattern with Cube and an MCP server querying in the user's context.

## Observability
- Kafka and connectors: health, consumer lag, throughput, anomalies via Prometheus and Grafana.
- Freshness and volume: Monte Carlo, or Great Expectations if open source is preferred.
- Metric-level anomaly detection; query cost observability.

## Scale, cost and retention
Sizing method: count emitters, signals per emitter, frequency; sample payloads for average size; derive daily/monthly/yearly volume; plan throughput, partitions, storage and tiers. Ask the client for real numbers rather than inventing them. Compression of 2-5x is an unvalidated estimate. Separate retention for Kafka (replay needs), S3 (raw history) and Snowflake (curated). Use columnar compressed formats, partitioning, lifecycle tiers, downsampling of old high-frequency signals while keeping critical raw signals as compliance or ML require. Also assess peak bursts, skew, replication overhead, backfill headroom and Snowflake costs.

## Alternatives considered and rejected
| Alternative | Why not (per author's trade-offs) |
|---|---|
| Streaming for all data | Complexity not justified where decisions happen days later |
| Managed ingestion instead of Kafka | Kept as option only at very small scale |
| Databricks | Credible, but Snowflake chosen for governance, isolation and AI integration; revisit if Spark/ML dominates |
| Cube + custom MCP for AI | More custom parts than native Snowflake semantic views and Cortex |
| Shared service account for AI queries | Would broaden access beyond the user's rights |
| Large up-front canonical model | Build incrementally from business questions |
| Early document RAG | Version authority unproven |

## AI: conversational analytics, evaluation, documents
- MVP: Snowflake semantic views with Cortex; assess Cortex Agents for the interface.
- Verified-query benchmark: questions paired with metric-owner-approved SQL; Cortex Analyst evaluations compare generated SQL results to validated results (correctness, regressions, latency); some questions excluded from the semantic view to reduce leakage. Run via EXECUTE_AI_EVALUATION and GET_ANALYST_AI_EVALUATION_DATA on a schedule or after semantic changes; set thresholds after measuring variance.
- Limits: one semantic view per run; multi-turn and agent tool behavior need a separate suite; evaluations consume credits.
- Success measures: SQL correctness, critical-question pass rate, regressions, latency, freshness SLA, disputed KPI definitions, metrics with named owners, query cost.
- Documents (after day 90): default to the latest authoritative version, historical only on explicit request. Chunk with version metadata; expose a search tool to the agent (RAG); evaluate vector, keyword and hybrid retrieval at top 1/3/5 against a human-reviewed set; fail evaluations that surface superseded guidance as current; filter by source permissions before retrieval.

## First 90 days and team split
| Days | Focus |
|---|---|
| 1-30 | Inventory sources, tables, KPI variants, owners, access constraints, quality gaps; pick one business process; accuracy baseline |
| 31-60 | Small canonical entity map, conformed dimensions, one or two facts, tests, repeatable ingestion patterns, approved metrics |
| 61-90 | One semantic view; show dashboard, SQL, KPI and AI answer reconcile; regression suite; report correctness, freshness, reliability, adoption, cost |

This is an MVP proof, not a migration of every dashboard.

Workstreams: ingestion engineering; platform engineering; business-embedded analytics engineering (modeling, dbt, identity resolution, KPI agreement, semantic layer, and AI-answer evaluation). With limited staff, merge ingestion and platform. Headcount is not assumed.

## Client questions
1. Which ten KPIs matter most, and along which dimensions are they sliced? This sets the minimum model and source priority.
2. For priority sources, what integration mechanisms exist, what are update frequency and volume, and what failure modes or constraints apply?
3. What are the access requirements across functions, teams and facilities, including isolation and sensitive fields?

Questions 4-5: open, to be selected by the author.

## Unresolved decisions
- Asset and source volumes, SLAs, peak load, failure/replay needs, residency, retention rules, budget.
- Which sources support sharing, connectors, CDC or incremental extracts.
- Whether S3 is the archival system of record for all streams or only telemetry/CDC; whether some sources load directly to Snowflake.
- Representation of historical dimension changes, late revisions, hard deletes.
- Governance: access model, PII classification, catalog, lineage, ownership, incident responsibility, data contracts.
- Documents: authority rules, latency, volume, indexing schedule, permissions, ranking quality.
