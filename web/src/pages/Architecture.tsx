import { useState } from 'react';
import { Badge, Card } from '../components/ui';
import { ArchitectureDiagram } from '../diagrams/ArchitectureDiagram';
import { DemoFlowDiagram } from '../diagrams/DemoFlowDiagram';
import * as C from './architectureContent';

const Bullets = ({ items }: { items: string[] }) => <ul className="bullets">{items.map((b, i) => <li key={i}>{b}</li>)}</ul>;

export function ArchitecturePage() {
  const [sel, setSel] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Architecture</h1>
        <p>The proposed platform. Hover a component for its rationale; click to pin it.</p>
      </div>

      <div className="callout">
        <strong>Recommendation</strong>
        {C.RECOMMENDATION.lead}
        <p style={{ margin: '8px 0 0' }}>{C.RECOMMENDATION.problem}</p>
      </div>

      <section className="section">
        <div className="grid c3">
          {C.DESIGN_BULLETS.map((d) => <Card key={d.title}><h3>{d.title}</h3><Bullets items={d.bullets} /></Card>)}
        </div>
      </section>

      <Card className="diagram-frame">
        <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Proposed architecture</h3>
          <span className="row small muted"><Badge tone="warn">Proposal</Badge> Orange dashed = governance · <span className="future-key">Purple dashed = future</span></span>
        </div>
        <ArchitectureDiagram selected={sel} onSelect={setSel} />
      </Card>

      <section className="section">
        <h2>What this demo actually runs</h2>
        <Card className="diagram-frame demo-frame">
          <DemoFlowDiagram />
        </Card>
      </section>

      <section className="section">
        <div className="grid c2">
          <Card><h3>Assumptions</h3><Bullets items={C.ASSUMPTIONS} /></Card>
          <Card>
            <h3>Questions for the client</h3>
            <ol className="steps" style={{ marginBottom: 0 }}>
              {C.QUESTIONS.map((q, i) => (
                <li key={i}>{q.q}{q.note && <div className="q-note">{q.note}</div>}</li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      <section className="section">
        <h2>Where I would go deeper</h2>
        <div className="grid c2">
          {C.DEEPER.map((d) => <Card key={d.title}><h3>{d.title}</h3><Bullets items={d.bullets} /></Card>)}
        </div>
      </section>

      <section className="section">
        <h2>Choices and tradeoffs</h2>
        <Card>
          <table className="choices">
            <tbody>
              {C.CHOICES.map((c) => (
                <tr key={c.choice}><td><strong>{c.choice}</strong></td><td className="muted">over {c.over}</td><td>{c.why}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="section">
        <h2>First 90 days</h2>
        <div className="timeline">
          {C.PHASES.map((p) => (
            <div className="phase" key={p.when}>
              <div className="when">{p.when}</div>
              <h3>{p.title}</h3>
              <Bullets items={p.bullets} />
            </div>
          ))}
        </div>
        <div className="grid c2" style={{ marginTop: 16 }}>
          <Card>
            <h3>Team of four</h3>
            <ul className="bullets">{C.TEAM.map((t) => <li key={t.who}><strong>{t.who}:</strong> {t.does}</li>)}</ul>
          </Card>
          <Card><h3>Definition of done</h3><Bullets items={C.DONE} /></Card>
        </div>
      </section>

      <section className="section">
        <h2>Future evolution</h2>
        <div className="grid c3">
          {C.EVOLUTION.map((e) => (
            <Card key={e.title}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 8, marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{e.title}</h3>
                <Badge tone={e.tag === 'Future' ? 'warn' : 'accent'}>{e.tag}</Badge>
              </div>
              {e.lead && <p className="small muted" style={{ margin: '0 0 6px' }}>{e.lead}</p>}
              {e.ordered
                ? <ol className="steps" style={{ marginBottom: 0 }}>{e.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                : <Bullets items={e.steps} />}
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="grid c2">
          <Card><h3>Not building yet</h3><Bullets items={C.NOT_YET} /></Card>
          <Card flat>
            <h3>AI use disclosure</h3>
            <ul className="bullets small muted">{C.AI_DISCLOSURE.map((d, i) => <li key={i}>{d}</li>)}</ul>
            <p className="small muted" style={{ marginBottom: 0 }}><em>{C.FOOTNOTE}</em></p>
          </Card>
        </div>
      </section>
    </>
  );
}
