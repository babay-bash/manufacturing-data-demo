/** Architecture page content, condensed from the author's proposal (docs/design.md). Data, not JSX. */

export interface NodeDetail { heading: string; group: 'Ingestion' | 'Storage and processing' | 'Metrics and access' | 'Quality and AI correctness' | 'Future development'; body: string[] }

/** Short rationale shown in the popover beside each diagram component. */
export const NODE_DETAILS: Record<string, NodeDetail> = {
  telemetry: { heading: 'Plant and field telemetry', group: 'Ingestion', body: [
    'High-volume signals; not all of them need real-time analytics.'] },
  erp: { heading: 'ERP, MES, CRM, acquired databases', group: 'Ingestion', body: [
    'Ingest with whatever each source supports. Keep source IDs and change/delete semantics.'] },
  gateway: { heading: 'Gateway / ingestion endpoint', group: 'Ingestion', body: [
    'Offline sites may need a durable buffer. Validate before committing to it.'] },
  kafka: { heading: 'Kafka', group: 'Ingestion', body: [
    'Used where throughput, buffering or multiple consumers justify it.',
    'Deduplicate on source event IDs, not Kafka offsets.'] },
  cdc: { heading: 'CDC / API / scheduled export', group: 'Ingestion', body: [
    'CDC where change streams are reliable; APIs or exports otherwise.',
    'Freshness differences between sources stay visible.'] },
  archive: { heading: 'Immutable object-storage archive', group: 'Storage and processing', body: [
    'Replay and recovery without paying to process unused signals.',
    'Iceberg only where several engines need the same large datasets.'] },
  raw: { heading: 'Selected raw datasets', group: 'Storage and processing', body: [
    'Unchanged source records, only for current use cases. Snowflake by default; reuse Databricks if it is already working.'] },
  dbt: { heading: 'dbt: standardized models', group: 'Storage and processing', body: [
    'Normalize types, time zones, units, status codes and naming.'] },
  canonical: { heading: 'Canonical entities, facts, dimensions', group: 'Storage and processing', body: [
    'Facts with explicit grain and shared dimensions.',
    'A crosswalk maps acquired systems to canonical IDs, using rules agreed with business owners.'] },
  metrics: { heading: 'Governed metrics / semantic layer', group: 'Metrics and access', body: [
    'Each certified metric has an owner, definition, grain and time rules.',
    'One name never means two things; CI rejects conflicts.'] },
  bi: { heading: 'BI and analyst SQL', group: 'Metrics and access', body: [
    'Same certified definitions as AI. Queries run as the user, so database RBAC, row and column policies apply.'] },
  ai: { heading: 'AI analytics assistant', group: 'Quality and AI correctness', body: [
    'Native semantic layer first, no custom agent stack. Shows which metric and source it used.'] },
  governance: { heading: 'Contracts, quality, lineage, access', group: 'Quality and AI correctness', body: [
    'Deterministic checks first: delivery, freshness, counts, nulls, deletes.',
    'Anomaly detection later. A KPI spike is a lead, not proof.'] },
  approved: { heading: 'Approved questions and expected results', group: 'Quality and AI correctness', body: [
    'Business-approved questions with canonical SQL and known answers.'] },
  regression: { heading: 'AI regression tests', group: 'Quality and AI correctness', body: [
    'Run after every model or definition change. Matching SQL is not enough if the data is wrong.'] },
  realtime: { heading: 'Real-time consumers (future)', group: 'Future development', body: [
    'Kafka feeds monitoring, ML models and recommendation systems directly. Only built for use cases that need it.'] },
  docsearch: { heading: 'Document search (future)', group: 'Future development', body: [
    'Requires clean versioning (current vs outdated) first. Then hybrid vector + keyword search with citations.'] },
};

export const RECOMMENDATION = {
  lead: 'Build a trusted data foundation before expanding AI. Start with one business process, its key sources and a few agreed metrics, shared by dashboards, SQL and AI.',
  problem: 'The problem is not tools. It is unclear ownership, conflicting KPIs, uneven quality, and AI answers that can’t be traced.',
};

export const ASSUMPTIONS = [
  'No reliable enterprise-wide customer, supplier or asset model today.',
  'Some sources support CDC; others only APIs or files.',
  'Not every telemetry signal needs real-time analytics.',
  'Small team; no need to migrate every pipeline at once.',
];

export const QUESTIONS: { q: string; note?: string }[] = [
  { q: 'Which key KPIs does the business depend on, and which cause the most pain today? Who owns each one?' },
  { q: 'What are the functional requirements for security and access: who should see which records, which facilities must be isolated, and which fields are sensitive?' },
  { q: 'For each priority source: which integration options exist, how often does data change, what are average and peak volumes, and what fault tolerance and failure modes must we handle? Which use cases truly need real-time data?' },
  { q: 'Which platforms and controls already exist that we should reuse, and which systems are authoritative for customer, supplier, asset and facility identity?' },
  { q: 'Which AI use cases are most urgent, and what counts as a correct, traceable answer?' },
];

/** Design detail, shown as bullets above the diagram. */
export const DESIGN_BULLETS: { title: string; bullets: string[]; sub?: { title: string; lead: string; bullets: string[] } }[] = [
  { title: 'Ingestion', bullets: [
    'CDC where reliable; APIs or exports otherwise.',
    'Keep source IDs, event and ingestion time, schema version.',
    'Kafka for telemetry where volume justifies it.',
    'Immutable archive for replay; dedup on event IDs.',
  ] },
  { title: 'Storage and processing', bullets: [
    'Snowflake + dbt by default; reuse Databricks if it is already in place.',
    'Raw stays unchanged; dbt standardizes.',
    'Facts with explicit grain, shared dimensions.',
    'Crosswalk to canonical IDs, rules agreed with owners.',
  ] },
  { title: 'Metrics and access', bullets: [
    'Each metric: owner, definition, grain, time rules.',
    'One name, one meaning; CI rejects conflicts.',
  ], sub: { title: 'Security model', lead: 'Access requirements from discovery are translated into:', bullets: [
    'Access and functional roles, with RBAC in the database.',
    'Row-level security (e.g. facility isolation); column masking for sensitive fields.',
    'SQL, BI and AI carry the user’s identity end to end, so every query goes through database RBAC.',
  ] } },
];

export const DEEPER = [
  { title: '1. Governed KPI example', bullets: [
    'Pick one disputed KPI with a business owner.',
    'Agree numerator, denominator, grain, exclusions.',
    'Reconcile with the business, then build tested dbt models and one certified definition.',
    'Dashboard SQL and AI return the same number.',
  ] },
  { title: '2. Quality and AI correctness', bullets: [
    'Check platform health, pipeline delivery and data correctness.',
    'Deterministic checks before anomaly detection.',
    'Test fixtures with known answers; approved AI questions with expected results.',
    'Log questions, generated SQL and freshness for review.',
  ] },
];

export const CHOICES: { choice: string; over: string; why: string }[] = [
  { choice: 'Focused MVP', over: 'enterprise rebuild', why: 'Prove one trusted path first.' },
  { choice: 'Reuse Snowflake / Databricks', over: 'platform replacement', why: 'Migration needs a measured benefit.' },
  { choice: 'Raw archive', over: 'all telemetry in Snowflake', why: 'Replay without processing unused signals.' },
  { choice: 'Selective Iceberg', over: 'a blanket rule', why: 'Worth it only when several engines share large data.' },
  { choice: 'Shared definitions', over: 'competing gold tables', why: 'Variants stay explicit and named.' },
  { choice: 'Measured AI evals', over: 'prompt-only fixes', why: 'Prompts can’t prove correctness.' },
];

export const PHASES = [
  { when: 'Days 1–30', title: 'Agree and baseline', bullets: ['Inventory sources and competing KPIs', 'Pick the key KPIs and an AI question set', 'Name owners; confirm access, volume and latency risks'] },
  { when: 'Days 31–60', title: 'Build one end-to-end path', bullets: ['Land sources; approve KPI SQL', 'Staging, facts/dims, dbt tests, semantic definition', 'CI, delivery checks, lineage, alerting'] },
  { when: 'Days 61–90', title: 'Certify and demonstrate', bullets: ['Reconcile the KPIs with their owners', 'Same result in SQL, dashboard and AI', 'Report freshness, failures and limits'] },
];

export const TEAM = [
  { who: 'Lead (me)', does: 'architecture, stakeholders, scope, AI correctness' },
  { who: 'Ingestion', does: 'sources and reconciliation' },
  { who: 'Analytics engineering', does: 'dbt models and semantic definitions' },
  { who: 'Platform', does: 'CI, access, monitoring, AI integration' },
];

export const DONE = [
  'A key set of business-approved KPIs, each with an owner and lineage',
  'Tested models and agreed freshness',
  'Same answer in SQL, dashboard and AI',
  'Access controls, repeatable deployment, visible failures',
];

/** How the platform evolves after day 90. */
export const EVOLUTION: { title: string; tag: string; lead?: string; ordered: boolean; steps: string[] }[] = [
  { title: 'Add KPIs and facts iteratively', tag: 'Iterative', ordered: true, steps: [
    'Start from a KPI with an owner.',
    'Ingest only the new sources it needs.',
    'Reuse conformed dimensions; extend them first.',
    'Add a dimension only for a new entity needed for slicing or a feature store.',
    'Certify the KPI and add regression cases.',
  ] },
  { title: 'Real-time use cases', tag: 'Future', ordered: false, lead: 'Kafka feeds these directly:', steps: [
    'Operational monitoring and alerting',
    'ML models (online features)',
    'Recommendation systems',
    'Only where seconds or minutes matter; batch stays the default.',
  ] },
  { title: 'AI on documents (RAG)', tag: 'Future', ordered: true, steps: [
    'First: versioning. Owners mark docs current or outdated.',
    'Latest valid version by default.',
    'Then hybrid search: vector similarity + keyword.',
    'Permission-filtered, with citations and dates.',
    'Test that the right source ranks first.',
  ] },
];

export const NOT_YET = [
  'Company-wide canonical model',
  'Wholesale dashboard migration',
  'Real-time for every source',
  'Broad document RAG',
  'Custom AI orchestration layer',
  'Iceberg everywhere',
];

export const AI_DISCLOSURE = [
  'Write-up: AI helped organize, edit and challenge trade-offs. Priorities and final choices are mine.',
  'Demo, generated with AI (Claude Code) from my specification and reviewed by me: the application code, the synthetic data and source samples (MES, QMS, ERP, telemetry), and the manufacturing KPI definitions.',
];

export const FOOTNOTE = 'A proposal based on stated assumptions; products and SLAs would be confirmed in discovery.';
