import { Download, Play, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { SqlExample, SqlResult, SqlTable } from '../api/types';
import { useStatus } from '../components/status';
import { Card, DataTable, Disclosure, EmptyState } from '../components/ui';

function toCsv(r: SqlResult): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [r.columns.map(esc).join(','), ...r.rows.map((row) => row.map(esc).join(','))].join('\r\n');
}

export function SqlExplorerPage({ go }: { go: (id: string) => void }) {
  const { status } = useStatus();
  const [examples, setExamples] = useState<SqlExample[]>([]);
  const [tables, setTables] = useState<SqlTable[]>([]);
  const [sql, setSql] = useState('SELECT * FROM marts.dim_facility');
  const [activeEx, setActiveEx] = useState<string | null>(null);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadedFirst = useRef(false);

  useEffect(() => {
    api.sqlExamples().then((ex) => {
      setExamples(ex);
      if (ex.length && !loadedFirst.current) { loadedFirst.current = true; setSql(ex[0].sql); setActiveEx(ex[0].id); }
    }).catch(() => {});
    api.sqlTables().then(setTables).catch(() => {});
  }, []);

  if (status && !status.ready) {
    return (
      <>
        <div className="page-head"><h1>SQL Explorer</h1></div>
        <EmptyState title="Nothing to query yet" action={<button className="btn primary" onClick={() => go('pipeline')}><Play size={15} />Go to Pipeline</button>}>
          Run the pipeline once to build the DuckDB marts and reporting views.
        </EmptyState>
      </>
    );
  }

  const run = async () => {
    setBusy(true); setError(null);
    try { setResult(await api.sql(sql)); }
    catch (e) { setResult(null); setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'query-result.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-head">
        <h1>SQL Explorer</h1>
        <p>Query the built marts and reporting views directly. The same KPI definitions that feed the dashboard live in the <code>reporting</code> views.</p>
      </div>

      <Card>
        {examples.length > 0 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            {examples.map((ex) => (
              <button key={ex.id} className={`chip ${activeEx === ex.id ? 'on' : ''}`} onClick={() => { setSql(ex.sql); setActiveEx(ex.id); }}>{ex.title}</button>
            ))}
          </div>
        )}
        <textarea className="editor" value={sql} spellCheck={false} aria-label="SQL editor"
          onChange={(e) => { setSql(e.target.value); setActiveEx(null); }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); } }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={run} disabled={busy || !sql.trim()}><Play size={15} />{busy ? 'Running…' : 'Run'}</button>
          <span className="small muted">Ctrl/Cmd + Enter</span>
          <span className="spacer" />
          <span className="small muted row"><ShieldCheck size={14} />Read-only · single SELECT · file access disabled · 5,000-row cap · 10 s limit</span>
        </div>
      </Card>

      {error && <div className="err" role="alert" style={{ marginTop: 16 }}>{error}</div>}

      {result && (
        <section className="section" style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="small muted">
              {result.row_count.toLocaleString('en-US')} rows · {result.seconds.toFixed(2)} s
              {result.truncated && <strong style={{ color: 'var(--warn)' }}> · truncated at {result.max_rows.toLocaleString('en-US')} rows</strong>}
            </span>
            <span className="spacer" />
            <button className="btn sm" onClick={download}><Download size={14} />CSV</button>
          </div>
          <DataTable className="results" columns={result.columns} rows={result.rows} />
        </section>
      )}

      <section className="section">
        <Disclosure title={`Tables you can query (${tables.length})`}>
          <DataTable columns={['Schema', 'Table', 'Description']} rows={tables.map((t) => [t.schema, t.name, t.description])} />
        </Disclosure>
      </section>
    </>
  );
}
