import { Logo } from './Logo';
import { DEMO_EDGES, DEMO_H, DEMO_NODES, DEMO_W } from './architectureLayout';
import { bezier, port, ScaledCanvas } from './ScaledCanvas';

/** "What this demo actually runs": a linear flow, visually distinct (green tint = really runs locally). */
export function DemoFlowDiagram() {
  const byId = Object.fromEntries(DEMO_NODES.map((n) => [n.id, n]));
  return (
    <ScaledCanvas w={DEMO_W} h={DEMO_H}>
      <svg width={DEMO_W} height={DEMO_H} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
        <defs>
          <marker id="dah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#148a5f" />
          </marker>
        </defs>
        {DEMO_EDGES.map(([f, t], i) => (
          <path key={i} d={bezier(port(byId[f].box, 'r'), 'r', port(byId[t].box, 'l'), 'l')} className="edge" style={{ stroke: '#148a5f' }} markerEnd="url(#dah)" />
        ))}
        <path d={bezier(port(byId.inter.box, 'b'), 'b', port(byId.quarantine.box, 't'), 't')} className="edge dashed" markerEnd="url(#dah)" />
      </svg>
      {DEMO_NODES.map((n) => (
        <div key={n.id} className="demo-node" style={{ left: n.box.x, top: n.box.y, width: n.box.w, height: n.box.h }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{n.logos.map((l, i) => <Logo key={i} kind={l} size="sm" />)}</div>
          <div><div className="nt">{n.title}</div><div className="ns">{n.sub}</div></div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 8, fontSize: 13, color: 'var(--text-2)' }}>
        Served by <strong>FastAPI</strong>, shown by a <strong>React</strong> app. Not deployed locally: <strong>Kafka, object storage, Snowflake, CDC, AI</strong>.
      </div>
    </ScaledCanvas>
  );
}
