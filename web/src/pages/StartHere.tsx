import { ArrowRight, BarChart3, Play, Terminal } from 'lucide-react';
import { Card } from '../components/ui';

/** Real component in this demo -> the production piece it stands in for (if any). */
const REAL_VS_STANDIN: [string, string][] = [
  ['Python ingestion with source contracts', 'Kafka, CDC and exports → committed files'],
  ['dbt models and 96 tests', 'Snowflake → DuckDB'],
  ['KPI definitions written once', 'Semantic layer → dbt_project.yml'],
  ['Read-only SQL and dashboard', 'AI assistant → not built'],
];

const STEPS = [
  { n: 1, title: 'Run the pipeline', text: 'Real ingestion + dbt build. ~5 seconds.', tab: 'pipeline', icon: <Play size={15} />, primary: true },
  { n: 2, title: 'Explore the dashboard', text: 'Cost per good unit, OEE, scrap, energy.', tab: 'dashboard', icon: <BarChart3 size={15} /> },
  { n: 3, title: 'Query with SQL', text: 'Read-only queries on the same tables.', tab: 'sql', icon: <Terminal size={15} /> },
];

export function StartHerePage({ go }: { go: (id: string) => void }) {
  return (
    <>
      <div className="hero page-head">
        <h1>A trusted data foundation, in miniature</h1>
        <p>A small slice of the proposed architecture, running locally on synthetic factory data.</p>
        <div className="question">How much does a good unit cost, and is extra cost driven by materials, energy, quality or downtime?</div>
      </div>

      <section className="section">
        <h2>Try it in 3 steps</h2>
        <div className="grid c3">
          {STEPS.map((s) => (
            <Card key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <button className={`btn ${s.primary ? 'primary' : ''}`} onClick={() => go(s.tab)}>{s.icon}Open<ArrowRight size={15} /></button>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="grid c2">
          <Card>
            <h3>Real here → production stand-in</h3>
            <table className="choices">
              <tbody>
                {REAL_VS_STANDIN.map(([real, standin]) => (
                  <tr key={real}><td><strong>{real}</strong></td><td className="muted">{standin}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3>What it proves</h3>
            <ul className="bullets">
              <li><strong>One KPI definition, one answer:</strong> dashboard, SQL and dbt reports match (Dashboard → reconciliation).</li>
              <li><strong>Quality you can see:</strong> bad rows are quarantined with a reason, and a failed run never replaces good data.</li>
              <li><strong>Not built:</strong> the AI assistant. Deterministic checks come first.</li>
            </ul>
          </Card>
        </div>
      </section>

      <p className="small muted">Run with <code>./start.command</code>; stop with <kbd>Ctrl</kbd>+<kbd>C</kbd>. All data is synthetic.</p>
    </>
  );
}
