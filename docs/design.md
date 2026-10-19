# Trusted Data Foundation: architecture proposal

> Source of truth: the author's Notion page *Trusted Data Foundation — Architecture Proposal*
> (October 19, 2026). The app's **Architecture** tab presents the same content with an interactive
> diagram. This is a proposal based on stated assumptions. Product choices and SLAs would be
> confirmed during discovery.

## Recommendation

Build a trusted data foundation before expanding AI use. Start with one high-value business
process, its key data sources and a small set of agreed metrics. Use the same governed
definitions for dashboards, SQL and AI answers. Do not try to replace every existing pipeline in
90 days.

The main problem is not a lack of tools. It is unclear ownership, conflicting KPI definitions,
uneven data quality, and AI answers that cannot be traced to approved sources.

## Assumptions and questions

I assume there is no reliable enterprise-wide customer, supplier or asset model today. Some
sources support CDC; others provide APIs or files. Telemetry is high-volume, but not every signal
needs real-time analytics. I assume a small delivery team and no requirement to migrate all
historical pipelines immediately.

Before finalizing the design, I would ask:

1. Which business decisions depend on the disputed KPIs? Who approves their definitions?
2. What platforms, source integrations and security controls already exist? What should we reuse?
3. How many assets, signals and source systems are involved? What are peak rates, retention needs
   and actual freshness requirements?
4. Which sources are authoritative for customer, supplier, asset and facility identity? How are
   conflicts resolved today?
5. Which AI use cases are most urgent, and what would count as a correct, traceable answer?

## Proposed architecture

Plant and field telemetry → gateway / ingestion endpoint → **Kafka** → **immutable object-storage
archive** ← CDC / API / scheduled export ← ERP, MES, CRM, acquired databases. From the archive:
selected raw datasets → **dbt** standardized models → canonical entities, facts, dimensions →
governed metrics / semantic layer → BI and analyst SQL, and an AI analytics assistant.
Contracts, quality checks, lineage and access controls govern the raw and canonical layers.
Approved questions with expected results feed AI regression tests, which the assistant must pass.

**Ingestion.** Use the mechanism each source supports. CDC is useful when reliable change streams
are available. APIs and scheduled exports are valid alternatives. Keep source IDs, event time,
ingestion time, schema version, and change or delete semantics. An export-based source may be a
day behind a CDC source; the canonical model must not hide that difference.

For telemetry, use Kafka where throughput, buffering and independent consumers justify it. Keep an
immutable archive in object storage for replay and recovery. Materialize only the signals needed
by current use cases. Use stable source event IDs to deduplicate curated data. Do not assume Kafka
offsets identify duplicate events published twice by a device. Offline facilities may need a
durable gateway buffer; validate that requirement before committing to it.

**Storage and processing.** The default is Snowflake with dbt, especially if Snowflake is already
in place. If the client has a working Databricks platform, favor reuse over migration. For a
greenfield, SQL-heavy analytics platform, lean toward Snowflake for managed operations, workload
isolation, governance and data sharing. Databricks is a strong alternative when Spark and ML
workloads dominate.

Raw source records stay unchanged. Standardized models normalize types, time zones, units, status
codes and source-specific naming. Curated models establish facts with explicit grain and shared
dimensions. A source-ID crosswalk maps acquired systems to canonical entity IDs. Matching rules and
authoritative attributes must be agreed with business owners, not guessed from similar names.

**Metrics and access.** Each certified metric needs an owner, definition, grain, filters, time
rules and documented variants. Different business definitions can coexist under different names;
the same name must not quietly mean two things. CI should reject missing owners and conflicting
names. Review is still needed to catch semantic duplicates with different names. Preserve the
requesting user's permissions through BI and AI tools; enforce row and column access at the data
layer.

## Where I would go deeper

**1. Governed KPI example.** Pick one disputed KPI with a business owner. Agree on numerator,
denominator, grain, date field, exclusions and allowed dimensions. Prototype the SQL against
source data and reconcile the result with the business team. Then implement tested dbt models and
one certified semantic definition. Show that dashboard SQL and an AI question return the same
result. A metric is not certified just because the pipeline succeeds.

**2. Quality and AI correctness.** Check reliability at three levels: platform health (connector
status, lag, warehouse availability), pipeline delivery (failures, missing or empty exports,
schema changes) and data correctness (freshness, source-to-target counts, nulls, deletes and
metric changes). Start with deterministic checks before adding anomaly detection. An unusual KPI
spike is worth investigating, but it is not proof of an error.

For critical models, use dbt tests and small controlled fixtures with independently known results.
Test the actual semantic definitions against expected outputs. Maintain a set of approved
natural-language questions with canonical SQL and expected results. Run these cases after changes
to models or semantic definitions; check selected metrics, filters, time windows and final
numbers. Log production questions, generated SQL, data freshness, failures and feedback for
review. Agreement between AI SQL and canonical SQL is not enough if the underlying data is wrong.

## AI and documents

For the first 90 days, focus the AI demonstration on governed structured metrics. Use Snowflake's
semantic layer and native AI analytics capability rather than adding a custom agent stack without
a clear need. The assistant should be able to show which metric definition and data source it
used.

Existing document assistants are already giving conflicting advice. Put immediate safeguards in
place: restrict high-risk answers, show source citations and document dates, and avoid presenting
unverified procedures as authoritative. A full document retrieval system comes later, after owners
define which manuals and notices are current, valid or superseded. The later design would use
version-aware, permission-filtered hybrid search and test whether the correct source appears in
top results.

## Choices and tradeoffs

| Choice | Over | Why |
|---|---|---|
| Focused MVP | Enterprise-wide rebuild | Prove one trusted data path first. A large migration delays value and blurs ownership. |
| Existing Snowflake or Databricks | Platform replacement | Migration needs a measured benefit, not a technology preference. |
| Raw object-storage archive | Sending all telemetry into Snowflake | Preserve replay and flexibility without paying to process unused signals. |
| Selective Iceberg | A blanket rule | Justified early if Snowflake *and* Spark need large telemetry datasets. Otherwise open raw files and native tables are simpler. Iceberg adds catalog, compaction, snapshot and compatibility work. |
| Shared definitions | Competing gold tables | Keep legitimate variants explicit. Don't force different business questions into one number. |
| Measured AI evaluations | Prompt-only fixes | Test actual results and regressions. Prompts alone cannot establish correctness. |
| Defer full document RAG | Building search now | Document authority and version rules must come first. |

## First 90 days

- **Days 1–30: agree and baseline.** Inventory the highest-value sources and competing KPI
  tables. Choose one KPI and one AI question set. Identify business owners and authoritative
  systems. Confirm security, data volume, latency and source-access risks. Record current KPI
  disagreements and freshness gaps.
- **Days 31–60: build a narrow end-to-end path.** Land required source data. Prototype and
  approve KPI SQL. Build source staging, canonical facts/dimensions, dbt tests and an initial
  semantic definition. Add CI, source delivery checks, and basic lineage and alerting.
- **Days 61–90: certify and demonstrate.** Reconcile the KPI with its owner. Show the same
  governed result in SQL, a simple dashboard and an AI analytics demo. Run regression cases for
  semantic changes and AI questions. Report freshness, quality failures, access behavior and known
  limitations.

**Team of four.** The lead owns architecture, stakeholder alignment, scope decisions and AI
correctness. One engineer owns ingestion and source reconciliation. One owns dbt, business models
and semantic definitions. One owns platform tooling, CI, access, monitoring and AI integration. The
AI demo is shared work, not a separate project started in the last week.

**Definition of done:** one business-approved KPI; a clear owner and source lineage; tested models;
agreed freshness; consistent SQL, dashboard and AI answers; access controls; repeatable deployment
and a visible failure path. If a required source is delayed, propose an alternate KPI or a clearly
labeled prototype rather than certify incomplete data.

## What I would not build yet

No company-wide canonical model, wholesale dashboard migration, real-time processing for every
source, broad document RAG rollout, or custom AI orchestration layer without a demonstrated need.
Avoid introducing Iceberg across all datasets solely because it is an open format.

## How this demo relates

The local demo (see README) implements a small, honest slice of *Where I would go deeper*:

- **Governed KPI example:** one fact table with explicit grain and six conformed dimensions. KPI
  definitions live in one place (`dbt_project.yml` vars) and are used by dbt, the SQL examples and
  the dashboard, and a test proves the dashboard and dbt agree.
- **Quality and correctness:** source contracts, 96 dbt tests, small controlled fixtures with
  independently known expected counts (`_manifest.json`), quarantine with reasons, idempotent
  re-runs, and a visible failure path (failed runs never replace the served data).
- **Not in the demo:** Kafka, object storage, Snowflake/Databricks, CDC, the semantic layer and
  the AI assistant and its regression tests. The demo stands in for them with committed landed
  files, DuckDB and dbt.
