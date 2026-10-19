import { CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { DataQualityRow, FixtureFile, Lineage, RunRecord } from '../api/types';
import { Stepper, type StepState } from '../components/Stepper';
import { useStatus } from '../components/status';
import { Card, DataTable, Disclosure } from '../components/ui';
import { LineageGraph } from '../diagrams/LineageGraph';
import { fmtDateTime, fmtSeconds } from '../lib/format';

const STEPS = [
  { label: 'Ingestion', key: 'ingest' },
  { label: 'dbt build', key: 'dbt' },
  { label: 'Verify', key: 'verif' },
  { label: 'Promote', key: 'promot' },
];
const stepIndex = (name: string | null | undefined) => STEPS.findIndex((s) => (name ?? '').toLowerCase().includes(s.key));

export function PipelinePage({ go }: { go: (id: string) => void }) {
  const { status, refresh } = useStatus();
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [curStep, setCurStep] = useState<string | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fixtures, setFixtures] = useState<FixtureFile[]>([]);
  const [lineage, setLineage] = useState<Lineage | null>(null);
  const [dq, setDq] = useState<DataQualityRow[] | null>(null);
  const [history, setHistory] = useState<RunRecord[] | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const polling = useRef(false);

  const loadArtifacts = useCallback(() => {
    api.lineage().then(setLineage).catch(() => setLineage(null));
    api.dataQuality().then(setDq).catch(() => setDq(null));
  }, []);

  useEffect(() => { api.fixtures().then(setFixtures).catch(() => {}); }, []);
  useEffect(() => { if (status?.ready) loadArtifacts(); }, [status?.ready, status?.last_success_at, loadArtifacts]);
  useEffect(() => { if (status?.last_run && !record && !running) setRecord(status.last_run); }, [status, record, running]);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);

  /** Poll progress every 500 ms until the server reports the run finished. */
  const poll = useCallback(async (startOffset: number) => {
    if (polling.current) return;
    polling.current = true;
    setRunning(true);
    let offset = startOffset;
    try {
      for (;;) {
        const p = await api.progress(offset);
        if (p.lines.length) setLines((l) => [...l, ...p.lines]);
        offset = p.next_offset;
        setCurStep(p.step);
        if (!p.running) {
          if (p.record) setRecord(p.record);
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      polling.current = false;
      setRunning(false);
      refresh();
      api.history().then(setHistory).catch(() => {});
    }
  }, [refresh]);

  // Attach to a run that was already started (e.g. page reload or another browser tab).
  useEffect(() => { if (status?.running && !polling.current) { setLines([]); void poll(0); } }, [status?.running, poll]);

  const run = async () => {
    setError(null); setLines([]); setRecord(null); setCurStep(null);
    try {
      await api.runPipeline();
      void poll(0);
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  };
  const reset = async () => {
    setConfirmReset(false); setError(null);
    try {
      await api.reset();
      setRecord(null); setLines([]); setLineage(null); setDq(null);
      refresh();
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  };

  // Stepper state: from the live step while running, from the final record afterwards.
  const cur = stepIndex(curStep);
  const failed = record?.status === 'failed';
  const seen = record ? Math.max(-1, ...record.steps.map((s) => stepIndex(s.step))) : -1;
  const stepStates: StepState[] = STEPS.map((_, i) => {
    if (running) return i < cur ? 'done' : i === cur ? 'active' : 'pending';
    if (!record) return 'pending';
    if (record.status === 'success') return 'done';
    return i <= seen ? 'done' : i === seen + 1 && failed ? 'failed' : 'pending';
  });
  const stepNote = (i: number) => {
    const s = record?.steps.find((x) => stepIndex(x.step) === i);
    return s && !running ? `${s.seconds.toFixed(1)}s` : undefined;
  };

  const by = record?.dbt?.by_status ?? {};
  const sum = (kind: string, ok: string) => by[`${kind}:${ok}`] ?? 0;
  const modelsTotal = Object.entries(by).filter(([k]) => k.startsWith('model:')).reduce((a, [, v]) => a + v, 0);
  const testsTotal = Object.entries(by).filter(([k]) => k.startsWith('test:')).reduce((a, [, v]) => a + v, 0);
  const counts = Object.entries(record?.lineage_counts ?? {});
  const layerOf = (k: string) => k.split('.')[0];

  return (
    <>
      <div className="page-head">
        <h1>Pipeline</h1>
        <p>Ingest the committed synthetic files into DuckDB, run the real dbt project (models and tests), and promote the result only if everything passed. Nothing here touches Kafka, S3 or Snowflake.</p>
      </div>

      <Card>
        <div className="row">
          <button className="btn primary big" onClick={run} disabled={running}><Play size={18} />{running ? 'Running…' : 'Run pipeline'}</button>
          {!confirmReset ? (
            <button className="btn" onClick={() => setConfirmReset(true)} disabled={running}><RotateCcw size={15} />Reset</button>
          ) : (
            <span className="row">
              <span className="small">Delete all built data?</span>
              <button className="btn sm danger" onClick={reset}>Yes, reset</button>
              <button className="btn sm" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          )}
          <span className="spacer" />
          {status?.last_success_at && <span className="small muted">Serving build from {fmtDateTime(status.last_success_at)}</span>}
        </div>
        <Stepper steps={STEPS.map((s, i) => ({ label: s.label, state: stepStates[i], note: stepNote(i) }))} />
        {error && <div className="err" role="alert">{error}</div>}
        {(running || lines.length > 0) && <div className="log" ref={logRef} aria-live="off">{lines.join('\n') || 'Starting…'}</div>}
      </Card>

      {record && !running && (
        <section className="section">
          {record.status === 'success' ? (
            <div className="callout ok row" style={{ flexWrap: 'nowrap' }}>
              <CheckCircle2 size={22} style={{ flex: 'none', color: 'var(--ok)' }} />
              <div><strong>Pipeline succeeded</strong>Every model and test passed, so the new build was promoted. Batch {record.batch_id ?? '—'}.
                {' '}<button className="btn sm" onClick={() => go('dashboard')}>Open dashboard</button></div>
            </div>
          ) : (
            <div className="callout bad">
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <XCircle size={22} style={{ flex: 'none', color: 'var(--bad)' }} />
                <div>
                  <strong>Pipeline failed</strong>
                  {record.error && <div>{record.error}</div>}
                  {status?.ready && <div className="small" style={{ marginTop: 4 }}>Nothing was promoted. The previous good build is still being served.</div>}
                </div>
              </div>
              {record.dbt?.failures?.length ? (
                <ul className="clean small" style={{ marginTop: 8 }}>
                  {record.dbt.failures.map((f, i) => <li key={i}><code>{f.node}</code>: {f.message}</li>)}
                </ul>
              ) : null}
            </div>
          )}

          <div className="grid c3" style={{ marginTop: 16 }}>
            <Card className="tile"><div className="label">Elapsed</div><div className="value">{fmtSeconds(record.elapsed_seconds)}</div></Card>
            <Card className="tile"><div className="label">Models passed</div><div className="value">{sum('model', 'success')} <span className="muted small">/ {modelsTotal}</span></div></Card>
            <Card className="tile"><div className="label">Tests passed</div><div className="value">{sum('test', 'pass')} <span className="muted small">/ {testsTotal}</span></div></Card>
          </div>
        </section>
      )}

      {!status?.ready && fixtures.length > 0 && (
        <section className="section">
          <h2>Landed files the pipeline will ingest</h2>
          <DataTable columns={['Source', 'File', 'Format', 'Size (KB)', 'Present']}
            rows={fixtures.map((f) => [f.source, f.file, f.format, f.size_kb, f.present ? 'yes' : 'MISSING'])} />
        </section>
      )}

      {record && counts.length > 0 && (
        <section className="section">
          <h2>Row counts by layer</h2>
          <DataTable columns={['Layer', 'Table', 'Rows']}
            rows={counts.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [layerOf(k), k.split('.').slice(1).join('.'), v])} />
        </section>
      )}

      {dq && dq.length > 0 && (
        <section className="section">
          <h2>Data quality</h2>
          <p className="muted">Nothing is silently dropped. Each issue is handled by a documented rule and counted here.</p>
          <DataTable columns={['Source', 'Issue', 'Handling', 'Events']} rows={dq.map((r) => [r.source, r.issue, r.handling, r.events])} />
        </section>
      )}

      {lineage && lineage.nodes.length > 0 && (
        <section className="section">
          <h2>dbt lineage</h2>
          <p className="muted">From dbt's manifest. Hover a model to trace everything upstream and downstream of it.</p>
          <Card><LineageGraph data={lineage} /></Card>
        </section>
      )}

      <section className="section">
        <Disclosure title="Run history" onToggle={(o) => { if (o) api.history().then(setHistory).catch(() => setHistory([])); }}>
          {history === null ? <span className="muted">Loading…</span> : history.length === 0 ? <span className="muted">No runs yet.</span> : (
            <DataTable columns={['Started', 'Status', 'Elapsed', 'Batch', 'Error']}
              rows={[...history].reverse().map((h) => [fmtDateTime(h.started_at), h.status, h.elapsed_seconds === undefined ? null : fmtSeconds(h.elapsed_seconds), h.batch_id ?? null, h.error ?? null])} />
          )}
        </Disclosure>
      </section>
    </>
  );
}
