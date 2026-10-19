/** Typed client for the fixed API contract in ./types.ts. Same-origin, relative to '/api'. */
import type {
  Dashboard, DashboardFilters, DataQualityRow, Dims, FixtureFile, KpiDefinition, Lineage,
  Progress, RunRecord, SqlExample, SqlResult, SqlTable, Status,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the demo API. Is the server running?');
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
      else if (body && body.detail) detail = JSON.stringify(body.detail);
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const api = {
  status: () => request<Status>('/status'),
  fixtures: () => request<FixtureFile[]>('/fixtures'),
  runPipeline: () => post<{ started: boolean }>('/pipeline/run'),
  progress: (offset: number) => request<Progress>(`/pipeline/progress?offset=${offset}`),
  reset: () => post<{ ok: boolean }>('/pipeline/reset'),
  history: () => request<RunRecord[]>('/pipeline/history'),
  lineage: () => request<Lineage>('/lineage'),
  dataQuality: () => request<DataQualityRow[]>('/data-quality'),
  sqlExamples: () => request<SqlExample[]>('/sql/examples'),
  sqlTables: () => request<SqlTable[]>('/sql/tables'),
  sql: (sql: string) => post<SqlResult>('/sql', { sql }),
  dims: () => request<Dims>('/dims'),
  kpiDefinitions: () => request<KpiDefinition[]>('/kpis/definitions'),
  dashboard: (f: DashboardFilters) => post<Dashboard>('/dashboard', f),
};
