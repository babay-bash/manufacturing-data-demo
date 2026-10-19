/** Proposal text for the Architecture tab. Source: Notion page "Trusted Data Foundation — Architecture Proposal".
 *  Wording is kept faithful to the proposal; this file is data only. */

export interface NodeDetail { heading: string; group: 'Ingestion' | 'Storage and processing' | 'Metrics and access' | 'Quality and AI correctness'; body: string[] }

export const NODE_DETAILS: Record<string, NodeDetail> = {
  telemetry: { heading: 'Plant and field telemetry', group: 'Ingestion', body: [
    'Telemetry is high-volume, but not every signal needs real-time analytics. Materialize only the signals needed by current use cases.',
    'Offline facilities may need a durable gateway buffer; validate that requirement before committing to it.'] },
  gateway: { heading: 'Gateway / ingestion endpoint', group: 'Ingestion', body: [
    'Offline facilities may need a durable gateway buffer; validate that requirement before committing to it.'] },
  kafka: { heading: 'Kafka', group: 'Ingestion', body: [
    'For telemetry, use Kafka where throughput, buffering, and independent consumers justify it.',
    'Use stable source event IDs to deduplicate curated data. Do not assume Kafka offsets identify duplicate events published twice by a device.'] },
  erp: { heading: 'ERP, MES, CRM, acquired databases', group: 'Ingestion', body: [
    'Some sources support CDC; others provide APIs or files. Use the mechanism each source supports.',
    'The proposal assumes there is no reliable enterprise-wide customer, supplier, or asset model today.'] },
  cdc: { heading: 'CDC / API / scheduled export', group: 'Ingestion', body: [
    'CDC is useful when reliable change streams are available. APIs and scheduled exports are valid alternatives.',
    'Keep source IDs, event time, ingestion time, schema version, and change or delete semantics. An export-based source may be a day behind a CDC source; the canonical model must not hide that difference.'] },
  archive: { heading: 'Immutable object-storage archive', group: 'Ingestion', body: [
    'Keep an immutable archive in object storage for replay and recovery. Raw object-storage archive over sending all telemetry into Snowflake: preserve replay and flexibility without paying to process unused signals.',
    'Selective Iceberg rather than a blanket rule: if Snowflake and Spark both need large telemetry datasets, Iceberg may be justified early. If only one engine needs the data, open raw files and native tables may be simpler. Iceberg adds catalog, compaction, snapshot maintenance, and multi-engine compatibility work.'] },
  raw: { heading: 'Selected raw datasets', group: 'Storage and processing', body: [
    'My default is Snowflake with dbt, especially if Snowflake is already in place. If the client has a working Databricks platform, I would favor reuse over migration.',
    'Keep raw source records unchanged. Only selected datasets are materialized, so unused signals are not processed.'] },
  dbt: { heading: 'dbt: standardized models', group: 'Storage and processing', body: [
    'Standardized models normalize types, time zones, units, status codes, and source-specific naming.',
    'For a greenfield, SQL-heavy analytics platform, I lean toward Snowflake for managed operations, workload isolation, governance, and data sharing. Databricks is a strong alternative when Spark and ML workloads dominate.'] },
  canonical: { heading: 'Canonical entities, facts, dimensions', group: 'Storage and processing', body: [
    'Curated models establish facts with explicit grain and shared dimensions. A source-ID crosswalk maps acquired systems to canonical entity IDs.',
    'Matching rules and authoritative attributes must be agreed with business owners, not guessed from similar names.'] },
  metrics: { heading: 'Governed metrics / semantic layer', group: 'Metrics and access', body: [
    'Each certified metric needs an owner, definition, grain, filters, time rules, and documented variants. Different business definitions can coexist under different names; the same name must not quietly mean two things.',
    'CI should reject missing owners and conflicting names. Review is still needed to catch semantic duplicates with different names.'] },
  bi: { heading: 'BI and analyst SQL', group: 'Metrics and access', body: [
    'Preserve the requesting user’s permissions through BI and AI tools; enforce row and column access at the data layer.',
    'Shared definitions over competing gold tables: keep legitimate variants explicit.'] },
  ai: { heading: 'AI analytics assistant', group: 'Metrics and access', body: [
    'For the first 90 days, focus the AI demonstration on governed structured metrics. Use Snowflake’s semantic layer and native AI analytics capability rather than adding a custom agent stack without a clear need.',
    'The assistant should be able to show which metric definition and data source it used. Preserve the requesting user’s permissions.'] },
  governance: { heading: 'Contracts, quality checks, lineage, access controls', group: 'Quality and AI correctness', body: [
    'Check reliability at three levels: platform health (connector status, lag, warehouse availability), pipeline delivery (failures, missing or empty exports, schema changes), and data correctness (freshness, source-to-target counts, nulls, deletes, and metric changes).',
    'Start with deterministic checks before adding anomaly detection. An unusual KPI spike is worth investigating, but it is not proof of an error. For critical models, use dbt tests and small controlled fixtures with independently known results.'] },
  approved: { heading: 'Approved questions and expected results', group: 'Quality and AI correctness', body: [
    'Maintain a set of approved natural-language questions with canonical SQL and expected results.'] },
  regression: { heading: 'AI regression tests', group: 'Quality and AI correctness', body: [
    'Run the approved cases after changes to models or semantic definitions; check selected metrics, filters, time windows, and final numbers.',
    'Log production questions, generated SQL, data freshness, failures, and feedback for review. Agreement between AI SQL and canonical SQL is not enough if the underlying data is wrong.'] },
};

export const RECOMMENDATION = {
  lead: 'Build a trusted data foundation before expanding AI use. Start with one high-value business process, its key data sources, and a small set of agreed metrics. Use the same governed definitions for dashboards, SQL, and AI answers. Do not try to replace every existing pipeline in 90 days.',
  problem: 'The main problem is not a lack of tools. It is unclear ownership, conflicting KPI definitions, uneven data quality, and AI answers that cannot be traced to approved sources.',
};

export const ASSUMPTIONS = 'I assume there is no reliable enterprise-wide customer, supplier, or asset model today. Some sources support CDC; others provide APIs or files. Telemetry is high-volume, but not every signal needs real-time analytics. I assume a small delivery team and no requirement to migrate all historical pipelines immediately.';

export const QUESTIONS = [
  'Which business decisions depend on the disputed KPIs? Who approves their definitions?',
  'What platforms, source integrations, and security controls already exist? What should we reuse?',
  'How many assets, signals, and source systems are involved? What are peak rates, retention needs, and actual freshness requirements?',
  'Which sources are authoritative for customer, supplier, asset, and facility identity? How are conflicts resolved today?',
  'Which AI use cases are most urgent, and what would count as a correct, traceable answer?',
];

export const DEEP_PARAGRAPHS = {
  ingestion: [
    'Use the mechanism each source supports. CDC is useful when reliable change streams are available. APIs and scheduled exports are valid alternatives. Keep source IDs, event time, ingestion time, schema version, and change or delete semantics. An export-based source may be a day behind a CDC source; the canonical model must not hide that difference.',
    'For telemetry, use Kafka where throughput, buffering, and independent consumers justify it. Keep an immutable archive in object storage for replay and recovery. Materialize only the signals needed by current use cases. Use stable source event IDs to deduplicate curated data. Do not assume Kafka offsets identify duplicate events published twice by a device. Offline facilities may need a durable gateway buffer; validate that requirement before committing to it.',
  ],
  storage: [
    'My default is Snowflake with dbt, especially if Snowflake is already in place. If the client has a working Databricks platform, I would favor reuse over migration. For a greenfield, SQL-heavy analytics platform, I lean toward Snowflake for managed operations, workload isolation, governance, and data sharing. Databricks is a strong alternative when Spark and ML workloads dominate.',
    'I would keep raw source records unchanged. Standardized models normalize types, time zones, units, status codes, and source-specific naming. Curated models establish facts with explicit grain and shared dimensions. A source-ID crosswalk maps acquired systems to canonical entity IDs. Matching rules and authoritative attributes must be agreed with business owners, not guessed from similar names.',
  ],
  metrics: [
    'Each certified metric needs an owner, definition, grain, filters, time rules, and documented variants. Different business definitions can coexist under different names; the same name must not quietly mean two things. CI should reject missing owners and conflicting names. Review is still needed to catch semantic duplicates with different names.',
    'Preserve the requesting user’s permissions through BI and AI tools; enforce row and column access at the data layer.',
  ],
};

export const DEEPER = [
  { title: '1. Governed KPI example', body: [
    'Pick one disputed KPI with a business owner. Agree on numerator, denominator, grain, date field, exclusions, and allowed dimensions. Prototype the SQL against source data and reconcile the result with the business team. Then implement tested dbt models and one certified semantic definition. Show that dashboard SQL and an AI question return the same result.',
    'A metric is not certified just because the pipeline succeeds.'] },
  { title: '2. Quality and AI correctness', body: [
    'Check reliability at three levels: platform health (connector status, lag, warehouse availability), pipeline delivery (failures, missing or empty exports, schema changes), and data correctness (freshness, source-to-target counts, nulls, deletes, and metric changes). Start with deterministic checks before adding anomaly detection. An unusual KPI spike is worth investigating, but it is not proof of an error.',
    'For critical models, use dbt tests and small controlled fixtures with independently known results. Test the actual semantic definitions against expected outputs. Maintain a set of approved natural-language questions with canonical SQL and expected results. Run these cases after changes to models or semantic definitions; check selected metrics, filters, time windows, and final numbers. Log production questions, generated SQL, data freshness, failures, and feedback for review. Agreement between AI SQL and canonical SQL is not enough if the underlying data is wrong.'] },
];

export const AI_DOCS = [
  'For the first 90 days, focus the AI demonstration on governed structured metrics. Use Snowflake’s semantic layer and native AI analytics capability rather than adding a custom agent stack without a clear need. The assistant should be able to show which metric definition and data source it used.',
  'Existing document assistants are already giving conflicting advice. I would put immediate safeguards in place: restrict high-risk answers, show source citations and document dates, and avoid presenting unverified procedures as authoritative. A full document retrieval system comes later, after owners define which manuals and notices are current, valid, or superseded. The later design would use version-aware, permission-filtered hybrid search and test whether the correct source appears in top results.',
];

export const CHOICES: { choice: string; over: string; why: string }[] = [
  { choice: 'Focused MVP', over: 'enterprise-wide rebuild', why: 'Prove one trusted data path first. A large migration would delay value and make ownership harder.' },
  { choice: 'Existing Snowflake or Databricks', over: 'platform replacement', why: 'Migration needs a measured benefit, not a technology preference.' },
  { choice: 'Raw object-storage archive', over: 'sending all telemetry into Snowflake', why: 'Preserve replay and flexibility without paying to process unused signals.' },
  { choice: 'Selective Iceberg', over: 'a blanket rule', why: 'If Snowflake and Spark both need large telemetry datasets, Iceberg may be justified early. If only one engine needs the data, open raw files and native tables may be simpler. Iceberg adds catalog, compaction, snapshot maintenance, and multi-engine compatibility work.' },
  { choice: 'Shared definitions', over: 'competing gold tables', why: 'Keep legitimate variants explicit. Do not silently force different business questions into one number.' },
  { choice: 'Measured AI evaluations', over: 'prompt-only fixes', why: 'Test actual results and regressions. Prompts alone cannot establish correctness.' },
  { choice: 'Defer full document RAG', over: 'building a new search interface now', why: 'Document authority and version rules must come before a new search interface.' },
];

export const PHASES = [
  { when: 'Days 1–30', title: 'Agree and baseline', body: 'Inventory the highest-value sources and competing KPI tables. Choose one KPI and one AI question set. Identify business owners and authoritative systems. Confirm security, data volume, latency, and source-access risks. Record current KPI disagreements and freshness gaps.' },
  { when: 'Days 31–60', title: 'Build a narrow end-to-end path', body: 'Land required source data. Prototype and approve KPI SQL. Build source staging, canonical facts/dimensions, dbt tests, and an initial semantic definition. Add CI, source delivery checks, and basic lineage and alerting.' },
  { when: 'Days 61–90', title: 'Certify and demonstrate', body: 'Reconcile the KPI with its owner. Show the same governed result in SQL, a simple dashboard, and an AI analytics demo. Run regression cases for semantic changes and AI questions. Report freshness, quality failures, access behavior, and known limitations.' },
];

export const TEAM = [
  { who: 'Me', does: 'Architecture, stakeholder alignment, scope decisions, and AI correctness.' },
  { who: 'Engineer 1', does: 'Ingestion and source reconciliation.' },
  { who: 'Engineer 2', does: 'dbt, business models, and semantic definitions.' },
  { who: 'Engineer 3', does: 'Platform tooling, CI, access, monitoring, and AI integration.' },
];
export const TEAM_NOTE = 'The AI demo is shared work, not a separate project started in the last week.';

export const DONE = 'One business-approved KPI; clear owner and source lineage; tested models; agreed freshness; consistent SQL, dashboard, and AI answers; access controls; repeatable deployment and a visible failure path. If a required source is delayed, I would propose an alternate KPI or clearly labeled prototype rather than certify incomplete data.';

export const NOT_YET = 'No company-wide canonical model, wholesale dashboard migration, real-time processing for every source, broad document RAG rollout, or custom AI orchestration layer without a demonstrated need. I would also avoid introducing Iceberg across all datasets solely because it is an open format.';

export const AI_DISCLOSURE = 'I used AI to organize and edit this write-up and to challenge architecture tradeoffs. The design priorities and final choices reflect my own judgment. I specifically revised the initial recommendation to defer Iceberg: for large telemetry datasets used by multiple engines, I would evaluate it early rather than reject it on complexity alone.';

export const FOOTNOTE = 'The architecture is a proposal based on stated assumptions. Product choices and SLAs would be confirmed during discovery.';
