/** Layout data for the proposal diagram: all coordinates are on a fixed design canvas (W x H).
 *  Nodes and edges mirror the mermaid flowchart in the Notion proposal; nothing is added. */
import type { LogoKind } from './Logo';
import type { Box, Side } from './ScaledCanvas';

export const ARCH_W = 1300;
export const ARCH_H = 700;

export interface Lane { id: string; label: string; box: Box; gov?: boolean; chips?: { logo: LogoKind; text: string; alt?: boolean }[] }
export interface ArchNode {
  id: string; title: string; sub?: string; logo: LogoKind; box: Box;
  badges?: { text: string; alt?: boolean }[]; extraLogos?: LogoKind[];
}
export interface ArchEdge { from: string; to: string; fs: Side; ts: Side; ff?: number; tf?: number; dashed?: boolean }

export const LANES: Lane[] = [
  { id: 'sources', label: 'Sources', box: { x: 10, y: 20, w: 205, h: 470 } },
  { id: 'ingestion', label: 'Ingestion', box: { x: 235, y: 20, w: 225, h: 470 } },
  {
    id: 'storage', label: 'Storage & processing', box: { x: 480, y: 20, w: 450, h: 470 },
    chips: [{ logo: 'snowflake', text: 'Snowflake (default)' }, { logo: 'databricks', text: 'Databricks (alternative)', alt: true }],
  },
  { id: 'metrics', label: 'Metrics & access', box: { x: 950, y: 20, w: 150, h: 470 } },
  { id: 'consumption', label: 'Consumption', box: { x: 1120, y: 20, w: 170, h: 470 } },
  { id: 'governance', label: 'Governance & control', box: { x: 480, y: 515, w: 810, h: 170 }, gov: true },
];

const nb = (x: number, y: number, w = 185, h = 78): Box => ({ x, y, w, h });

export const NODES: ArchNode[] = [
  { id: 'telemetry', title: 'Plant and field telemetry', logo: 'sensors', box: nb(20, 80) },
  { id: 'erp', title: 'ERP, MES, CRM, acquired databases', logo: 'erp', box: nb(20, 300, 185, 90) },
  { id: 'gateway', title: 'Gateway / ingestion endpoint', logo: 'gateway', box: nb(245, 80, 205) },
  { id: 'kafka', title: 'Kafka', sub: 'where throughput justifies it', logo: 'kafka', box: nb(245, 190, 205, 70) },
  { id: 'cdc', title: 'CDC / API / scheduled export', sub: 'the mechanism each source supports', logo: 'cdc', box: nb(245, 300, 205, 90) },
  {
    id: 'archive', title: 'Immutable object-storage archive', sub: 'replay and recovery', logo: 'archive', box: nb(495, 150, 200, 90),
    badges: [{ text: 'Iceberg: selective' }],
  },
  { id: 'raw', title: 'Selected raw datasets', sub: 'unchanged source records', logo: 'snowflake', box: nb(495, 300, 200, 92), badges: [{ text: 'Databricks: alternative', alt: true }] },
  { id: 'dbt', title: 'dbt: standardized models', sub: 'types, time zones, units, status codes', logo: 'dbt', box: nb(715, 300, 200, 80) },
  { id: 'canonical', title: 'Canonical entities, facts, dimensions', sub: 'explicit grain, shared dims', logo: 'canonical', box: nb(715, 400, 200, 80) },
  { id: 'metrics', title: 'Governed metrics / semantic layer', sub: 'owner, definition, grain', logo: 'metrics', box: nb(960, 270, 130, 130) },
  { id: 'bi', title: 'BI and analyst SQL', logo: 'bi', box: nb(1130, 150, 150, 80) },
  { id: 'ai', title: 'AI analytics assistant', logo: 'ai', box: nb(1130, 380, 150, 80) },
  { id: 'governance', title: 'Contracts, quality checks, lineage, access controls', logo: 'shield', box: nb(500, 570, 380, 80) },
  { id: 'approved', title: 'Approved questions and expected results', logo: 'questions', box: nb(930, 570, 160, 80) },
  { id: 'regression', title: 'AI regression tests', logo: 'regression', box: nb(1120, 570, 150, 80) },
];

export const EDGES: ArchEdge[] = [
  { from: 'telemetry', to: 'gateway', fs: 'r', ts: 'l' },
  { from: 'gateway', to: 'kafka', fs: 'b', ts: 't' },
  { from: 'kafka', to: 'archive', fs: 'r', ts: 'l', tf: 0.3 },
  { from: 'erp', to: 'cdc', fs: 'r', ts: 'l' },
  { from: 'cdc', to: 'archive', fs: 'r', ts: 'l', tf: 0.75 },
  { from: 'archive', to: 'raw', fs: 'b', ts: 't' },
  { from: 'raw', to: 'dbt', fs: 'r', ts: 'l' },
  { from: 'dbt', to: 'canonical', fs: 'b', ts: 't' },
  { from: 'canonical', to: 'metrics', fs: 'r', ts: 'l', tf: 0.8 },
  { from: 'metrics', to: 'bi', fs: 'r', ts: 'l' },
  { from: 'metrics', to: 'ai', fs: 'r', ts: 'l' },
  { from: 'governance', to: 'raw', fs: 't', ts: 'b', ff: 0.2, tf: 0.5, dashed: true },
  { from: 'governance', to: 'canonical', fs: 't', ts: 'b', ff: 0.8, tf: 0.5, dashed: true },
  { from: 'approved', to: 'regression', fs: 'r', ts: 'l' },
  { from: 'ai', to: 'regression', fs: 'b', ts: 't', ff: 0.5, tf: 0.5 },
];

/** Demo flow (second diagram): "what this demo actually runs". */
export const DEMO_W = 1300;
export const DEMO_H = 300;
const COLW = 138;
const GAP = 22;
const dx = (i: number) => 14 + i * (COLW + GAP);
export interface DemoNode { id: string; title: string; sub: string; logos: LogoKind[]; box: Box }
export const DEMO_NODES: DemoNode[] = [
  { id: 'files', title: 'Landed files', sub: 'committed synthetic files', logos: ['files'], box: { x: dx(0), y: 60, w: COLW, h: 92 } },
  { id: 'ingest', title: 'Python ingestion', sub: 'contracts, lineage columns', logos: ['python'], box: { x: dx(1), y: 60, w: COLW, h: 92 } },
  { id: 'raw', title: 'DuckDB raw', sub: 'raw.* snapshots', logos: ['duckdb'], box: { x: dx(2), y: 60, w: COLW, h: 92 } },
  { id: 'staging', title: 'dbt staging', sub: 'typing, unit normalization', logos: ['dbt'], box: { x: dx(3), y: 60, w: COLW, h: 92 } },
  { id: 'inter', title: 'Intermediate', sub: 'dedup, crosswalks, tariffs', logos: ['dbt'], box: { x: dx(4), y: 60, w: COLW, h: 92 } },
  { id: 'quarantine', title: 'Quarantine', sub: 'bad rows kept, with a reason', logos: ['alert'], box: { x: dx(4), y: 190, w: COLW, h: 78 } },
  { id: 'marts', title: 'Marts', sub: '6 dims + 1 fact', logos: ['dbt'], box: { x: dx(5), y: 60, w: COLW, h: 92 } },
  { id: 'reporting', title: 'Reporting views', sub: 'kpi_* and data quality', logos: ['dbt'], box: { x: dx(6), y: 60, w: COLW, h: 92 } },
  { id: 'sql', title: 'SQL Explorer', sub: 'read-only, guarded', logos: ['fastapi', 'react'], box: { x: dx(7), y: 20, w: COLW, h: 88 } },
  { id: 'dash', title: 'Dashboard', sub: 'same KPI definitions', logos: ['fastapi', 'react'], box: { x: dx(7), y: 120, w: COLW, h: 88 } },
];
export const DEMO_EDGES: [string, string][] = [
  ['files', 'ingest'], ['ingest', 'raw'], ['raw', 'staging'], ['staging', 'inter'], ['inter', 'marts'], ['marts', 'reporting'],
  ['reporting', 'sql'], ['reporting', 'dash'],
];
