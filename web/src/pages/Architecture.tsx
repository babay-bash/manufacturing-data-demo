import { AlertTriangle, Layers } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card } from '../components/ui';
import { ArchitectureDiagram } from '../diagrams/ArchitectureDiagram';
import { DemoFlowDiagram } from '../diagrams/DemoFlowDiagram';
import * as C from './architectureContent';

export function ArchitecturePage() {
  const [sel, setSel] = useState<string | null>(null);
  const detail = sel ? C.NODE_DETAILS[sel] : null;

  return (
    <>
      <div className="page-head">
        <h1>Architecture</h1>
        <p>
          The proposed Trusted Data Foundation, as written in the architecture proposal. Hover or click a component to see its
          rationale. The second diagram shows the much smaller slice this demo actually runs.
        </p>
      </div>

      <Card className="diagram-frame">
        <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Proposed architecture</h3>
          <span className="row small muted"><Badge tone="warn">Proposal</Badge> Dashed lines = governance and control</span>
        </div>
        <ArchitectureDiagram selected={sel} onSelect={setSel} />
      </Card>
      <Card className="detail">
        {detail ? (
          <>
            <div className="row"><h3 style={{ margin: 0 }}>{detail.heading}</h3><Badge tone="accent">{detail.group}</Badge></div>
            {detail.body.map((p, i) => <p key={i} style={{ marginTop: 8, marginBottom: 0 }}>{p}</p>)}
          </>
        ) : (
          <span className="muted">Select a component above to read the reasoning behind it.</span>
        )}
      </Card>

      <section className="section">
        <h2>What this demo actually runs</h2>
        <Card className="diagram-frame demo-frame">
          <DemoFlowDiagram />
        </Card>
      </section>

      <section className="section">
        <div className="callout">
          <strong>Recommendation</strong>
          {C.RECOMMENDATION.lead}
          <p style={{ margin: '10px 0 0' }}>{C.RECOMMENDATION.problem}</p>
        </div>
      </section>

      <section className="section">
        <h2>Assumptions and questions</h2>
        <div className="grid c2">
          <Card><h3>Assumptions</h3><p className="muted" style={{ marginBottom: 0 }}>{C.ASSUMPTIONS}</p></Card>
          <Card>
            <h3>Questions I would ask before finalizing the design</h3>
            <ol className="clean" style={{ paddingLeft: 20, margin: 0 }}>{C.QUESTIONS.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ol>
          </Card>
        </div>
      </section>

      <section className="section">
        <h2>Design detail</h2>
        <div className="grid c3">
          <Card><h3>Ingestion</h3>{C.DEEP_PARAGRAPHS.ingestion.map((p, i) => <p key={i} className="small">{p}</p>)}</Card>
          <Card><h3>Storage and processing</h3>{C.DEEP_PARAGRAPHS.storage.map((p, i) => <p key={i} className="small">{p}</p>)}</Card>
          <Card><h3>Metrics and access</h3>{C.DEEP_PARAGRAPHS.metrics.map((p, i) => <p key={i} className="small">{p}</p>)}</Card>
        </div>
      </section>

      <section className="section">
        <h2>Where I would go deeper</h2>
        <div className="grid c2">
          {C.DEEPER.map((d) => (
            <Card key={d.title}><h3>{d.title}</h3>{d.body.map((p, i) => <p key={i} className="small">{p}</p>)}</Card>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>AI and documents</h2>
        <Card>{C.AI_DOCS.map((p, i) => <p key={i} style={{ marginBottom: i ? 0 : undefined }}>{p}</p>)}</Card>
      </section>

      <section className="section">
        <h2>Choices and tradeoffs</h2>
        <div className="grid c3">
          {C.CHOICES.map((c) => (
            <Card key={c.choice} className="vs">
              <div className="over">Chosen</div>
              <h3 style={{ margin: 0 }}>{c.choice}</h3>
              <div className="over">Over</div>
              <div style={{ fontWeight: 550 }}>{c.over}</div>
              <p className="small muted" style={{ margin: '6px 0 0' }}>{c.why}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>First 90 days</h2>
        <div className="timeline">
          {C.PHASES.map((p) => (
            <div className="phase" key={p.when}>
              <div className="when">{p.when}</div>
              <h3>{p.title}</h3>
              <p className="small" style={{ marginBottom: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
        <div className="grid c2" style={{ marginTop: 16 }}>
          <Card>
            <h3>Four-person team</h3>
            <ul className="clean">{C.TEAM.map((t) => <li key={t.who}><strong>{t.who}:</strong> {t.does}</li>)}</ul>
            <p className="small muted" style={{ marginBottom: 0 }}>{C.TEAM_NOTE}</p>
          </Card>
          <Card><h3>Definition of done</h3><p style={{ marginBottom: 0 }}>{C.DONE}</p></Card>
        </div>
      </section>

      <section className="section">
        <h2>What I would not build yet</h2>
        <Card><div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><AlertTriangle size={18} style={{ flex: 'none', marginTop: 3 }} /><span>{C.NOT_YET}</span></div></Card>
      </section>

      <section className="section">
        <h2>AI use disclosure</h2>
        <Card flat><div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><Layers size={18} style={{ flex: 'none', marginTop: 3 }} /><span className="muted">{C.AI_DISCLOSURE}</span></div></Card>
        <p className="small muted" style={{ marginTop: 12 }}><em>{C.FOOTNOTE}</em></p>
      </section>
    </>
  );
}
