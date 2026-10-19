/**
 * API contract between the React UI and the Python API (server/api.py).
 * All endpoints are same-origin under /api. Errors return HTTP 4xx/5xx with {"detail": string}.
 */

export type RunStatus = "running" | "success" | "failed";

export interface RunRecord {
  started_at: string;            // ISO UTC
  finished_at?: string;
  status: RunStatus;
  elapsed_seconds?: number;
  batch_id?: string;
  steps: { step: string; seconds: number }[];
  dbt?: { by_status: Record<string, number>; failures: { node: string; message: string }[] };
  lineage_counts?: Record<string, number>; // "schema.table" -> rows
  error?: string;
}

/** GET /api/status */
export interface Status {
  ready: boolean;                // a successful build is being served
  running: boolean;              // a pipeline run is in progress
  data_home: string;             // writable folder with DuckDB files
  last_run: RunRecord | null;
  last_success_at: string | null;
}

/** GET /api/fixtures */
export interface FixtureFile { source: string; file: string; format: string; size_kb: number | null; present: boolean }

/** POST /api/pipeline/run -> 202 {started:true} | 409 {detail}
 *  GET  /api/pipeline/progress?offset=N  (poll every ~500 ms while running) */
export interface Progress {
  running: boolean;
  step: string | null;           // current step label
  lines: string[];               // new log lines since `offset`
  next_offset: number;
  record: RunRecord | null;      // final record once finished (null while running)
}
/** POST /api/pipeline/reset -> {ok:true} | 409
 *  GET  /api/pipeline/history -> RunRecord[] (newest last) */

/** GET /api/lineage -> dbt model graph from manifest.json (empty arrays before first run) */
export interface Lineage {
  nodes: { id: string; layer: "raw" | "staging" | "intermediate" | "quarantine" | "marts" | "reporting" }[];
  edges: { from: string; to: string }[];
}

/** GET /api/data-quality (409 if not ready) */
export interface DataQualityRow { source: string; issue: string; handling: string; events: number }

/** GET /api/sql/examples */
export interface SqlExample { id: string; title: string; sql: string }
/** GET /api/sql/tables */
export interface SqlTable { schema: string; name: string; description: string }
/** POST /api/sql {sql} -> SqlResult | 400 {detail: reason (blocked / parse / runtime error)} | 409 not ready */
export interface SqlResult {
  columns: string[];
  rows: (string | number | boolean | null)[][]; // dates/decimals serialized as strings/numbers
  row_count: number;
  truncated: boolean;            // capped at max_rows
  max_rows: number;
  seconds: number;
}

/** GET /api/dims (409 if not ready) */
export interface Dims {
  facilities: { id: string; name: string }[];   // ordered by id: F-DE, F-MX, F-OH
  lines: { id: string; name: string; facility_id: string }[];
  products: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  date_min: string;              // YYYY-MM-DD
  date_max: string;
}

export type KpiName =
  | "good_units" | "variable_cost_per_good_unit" | "material_cost_per_good_unit" | "oee"
  | "availability" | "performance" | "quality_rate" | "scrap_rate" | "energy_kwh_per_good_unit"
  | "downtime_hours";
export type KpiFormat = "int" | "usd" | "pct" | "kwh" | "hours";

/** GET /api/kpis/definitions (from dbt_project.yml vars — the single source of truth) */
export interface KpiDefinition { name: KpiName; label: string; fmt: KpiFormat; sql: string; description: string }

/** POST /api/dashboard  body: DashboardFilters (omit a key = all) */
export interface DashboardFilters {
  date_from?: string; date_to?: string;
  facility_id?: string; line_id?: string; product_id?: string; shift_code?: string;
}
export interface Dashboard {
  totals: Record<KpiName, number | null>;      // null = zero denominator
  daily: { date: string; facility_id: string; facility_name: string; oee: number | null;
           variable_cost_per_good_unit: number | null; good_units: number }[];
  by_facility: { facility_id: string; facility_name: string; variable_cost_per_good_unit: number | null;
                 material_cost_per_good_unit: number | null; oee: number | null; scrap_rate: number | null }[];
  by_line: { line_id: string; facility_id: string; facility_name: string; oee: number | null;
             availability: number | null; performance: number | null; quality_rate: number | null;
             downtime_hours: number | null }[];
  by_product: { product_id: string; product_name: string; scrap_rate: number | null; good_units: number }[];
  sql: Record<string, string>;                 // panel name -> exact SQL that produced it (params as ?)
  params: (string)[];                          // bound parameter values, in order
  reconciliation: { name: KpiName; label: string; dashboard: number | null; dbt: number | null; match: boolean }[];
}
