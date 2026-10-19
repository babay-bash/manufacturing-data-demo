import { useMemo, useState } from 'react';
import { Logo } from './Logo';
import { ARCH_H, ARCH_W, EDGES, LANES, NODES } from './architectureLayout';
import { bezier, port, ScaledCanvas } from './ScaledCanvas';

/** Proposal architecture. Hover previews, click pins a node; connected edges/nodes stay highlighted, others dim. */
export function ArchitectureDiagram({ onSelect, selected }: { onSelect: (id: string | null) => void; selected: string | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const active = hover ?? selected;
  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);
  const connected = useMemo(() => {
    const s = new Set<string>();
    if (active) { s.add(active); EDGES.forEach((e) => { if (e.from === active) s.add(e.to); if (e.to === active) s.add(e.from); }); }
    return s;
  }, [active]);

  return (
    <ScaledCanvas w={ARCH_W} h={ARCH_H}>
      {LANES.map((l) => (
        <div key={l.id} className={`lane ${l.gov ? 'gov' : ''}`} style={{ left: l.box.x, top: l.box.y, width: l.box.w, height: l.box.h }}>
          <div className="lane-label">{l.label}</div>
          {l.chips && (
            <div className="lane-chips">
              {l.chips.map((c) => (
                <span key={c.text} className={`badge ${c.alt ? 'warn' : 'accent'}`}><Logo kind={c.logo} size="sm" />{c.text}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      <svg width={ARCH_W} height={ARCH_H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
        <defs>
          {['#8b95a5', '#2a78d6', '#d98a00'].map((c, i) => (
            <marker key={i} id={`ah${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>
        {EDGES.map((e, i) => {
          const a = port(byId[e.from].box, e.fs, e.ff);
          const b = port(byId[e.to].box, e.ts, e.tf);
          const hot = !!active && (e.from === active || e.to === active);
          const dim = !!active && !hot;
          const marker = e.dashed ? 'ah2' : hot ? 'ah1' : 'ah0';
          return <path key={i} d={bezier(a, e.fs, b, e.ts)} markerEnd={`url(#${marker})`}
            className={`edge ${e.dashed ? 'dashed' : ''} ${hot ? 'hot' : ''} ${dim ? 'dim' : ''}`} />;
        })}
      </svg>
      {NODES.map((n) => {
        const dim = !!active && !connected.has(n.id);
        return (
          <button key={n.id} className={`anode ${selected === n.id ? 'active' : ''} ${dim ? 'dim' : ''}`}
            style={{ left: n.box.x, top: n.box.y, width: n.box.w, height: n.box.h }}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
            onClick={() => onSelect(selected === n.id ? null : n.id)}>
            <Logo kind={n.logo} />
            <span>
              <span className="nt">{n.title}</span>
              {n.sub && <span className="ns">{n.sub}</span>}
              {n.badges?.map((b) => <span key={b.text} className={`mini-badge ${b.alt ? 'alt' : ''}`}>{b.text}</span>)}
            </span>
          </button>
        );
      })}
    </ScaledCanvas>
  );
}
