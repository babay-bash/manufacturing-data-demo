import { ArrowRight, BarChart3, Play, Terminal } from 'lucide-react';
import { Card } from '../components/ui';

const REAL = [
  'Python ingestion with source contracts and lineage columns',
  'dbt models and 96 tests (dbt-core + dbt-duckdb)',
  'DuckDB as the local warehouse',
  'KPI definitions, written once in dbt_project.yml',
  'SQL guard (read-only, single SELECT)',
  'Blue/green promotion: a failed build never replaces the last good one',
];
const SIM: [string, string][] = [
  ['Kafka and the gateway', 'committed landed files'],
  ['Object-storage archive', 'committed landed files'],
  ['Snowflake', 'DuckDB'],
  ['CDC from ERP / MES', 'full-snapshot file loads'],
  ['Semantic layer and AI assistant', 'KPI vars in dbt_project.yml'],
];

const LOOK_FOR = [
  <><strong>An inefficient line:</strong> MX-L2 stands out as inefficient. Compare its OEE and cost per good unit with the other lines.</>,
  <><strong>An energy-heavy machine:</strong> M-OH-L1-01 is the energy-heavy one. Find it in the SQL Explorer.</>,
  <><strong>A scrap excursion:</strong> Stuttgart scrap rises on the VFD 15kW product in July.</>,
  <><strong>Quarantined anomalies:</strong> bad energy readings, an unmapped historian tag, orphan QMS events. Nothing is silently dropped.</>,
  <><strong>One number, three views:</strong> the dashboard, the SQL Explorer and the dbt reporting views reconcile.</>,
];

export function StartHerePage({ go }: { go: (id: string) => void }) {
  return (
    <>
      <div className="hero page-head">
        <h1>A trusted data foundation, in miniature</h1>
        <p>
          This is a small, honest slice of the proposed architecture running entirely on your laptop. Synthetic factory
          files are ingested by real Python, transformed and tested by real dbt on DuckDB, and served through SQL and a dashboard
          that share one set of KPI definitions. It is a local demo, not a production system.
        </p>
        <div className="question">
          How much does it cost to make a good unit, and is excess cost driven by materials, energy, quality or downtime?
        </div>
      </div>

      <section className="section">
        <h2>Try it in 3 steps</h2>
        <div className="grid c3">
          <Card className="step-card">
            <div className="step-n">1</div>
            <h3>Run the pipeline</h3>
            <p>Ingest the landed files, run dbt build (32 models, 96 tests) and promote the result. About 5 to 10 seconds.</p>
            <button className="btn primary" onClick={() => go('pipeline')}><Play size={15} />Open Pipeline<ArrowRight size={15} /></button>
          </Card>
          <Card className="step-card">
            <div className="step-n">2</div>
            <h3>Explore the dashboard</h3>
            <p>Filter by facility, line, product and shift. Every tile shows its definition and every chart shows its SQL.</p>
            <button className="btn" onClick={() => go('dashboard')}><BarChart3 size={15} />Open Dashboard<ArrowRight size={15} /></button>
          </Card>
          <Card className="step-card">
            <div className="step-n">3</div>
            <h3>Ask SQL</h3>
            <p>Run your own read-only SELECT against the built marts and reporting views, or start from an example.</p>
            <button className="btn" onClick={() => go('sql')}><Terminal size={15} />Open SQL Explorer<ArrowRight size={15} /></button>
          </Card>
        </div>
      </section>

      <section className="section">
        <h2>What's real vs simulated</h2>
        <div className="table-wrap">
          <table className="t compare">
            <thead><tr><th className="real">Real here</th><th className="sim">Simulated or not deployed (stand-in)</th></tr></thead>
            <tbody>
              {REAL.map((r, i) => (
                <tr key={i}>
                  <td>{r}</td>
                  <td>{SIM[i] ? <>{SIM[i][0]} <span className="muted">→ {SIM[i][1]}</span></> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Nothing in this demo runs Kafka, object storage, Snowflake, CDC or an AI assistant.</p>
      </section>

      <section className="section">
        <h2>What to look for</h2>
        <Card><ul className="clean">{LOOK_FOR.map((l, i) => <li key={i}>{l}</li>)}</ul></Card>
      </section>

      <section className="section">
        <h2>How it maps to the proposal</h2>
        <p className="muted">The proposal's "Where I would go deeper" section names two items. This demo exercises both on synthetic data.</p>
        <div className="map-row">
          <Card>
            <h3>1. Governed KPI example</h3>
            <ul className="clean">
              <li>KPIs are ratios of sums, defined once in <code>dbt_project.yml</code>.</li>
              <li>The dashboard SQL and the dbt <code>reporting.kpi_*</code> views come from that one definition.</li>
              <li>The Dashboard's reconciliation panel shows they return the same numbers.</li>
            </ul>
          </Card>
          <Card>
            <h3>2. Quality and AI correctness</h3>
            <ul className="clean">
              <li>96 dbt tests run on every pipeline click; fixtures have independently known expected counts.</li>
              <li>Bad rows go to quarantine with a reason; the Pipeline tab shows the counts.</li>
              <li>Blue/green promotion shows a visible failure path. No AI assistant is built: the deterministic checks come first.</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="section">
        <Card flat>
          <h3>How to run and stop</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            Start with <code>./start.command</code> from the repo or release folder; the browser opens automatically.
            Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in Terminal to stop. The Reset button on the Pipeline tab deletes the built data.
          </p>
        </Card>
      </section>
    </>
  );
}
