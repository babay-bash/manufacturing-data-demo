import { NODE_DETAILS } from '../pages/architectureContent';
import { useEffect, useMemo, useState } from 'react';
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
    <ScaledCanvas w={ARCH_W} h={ARCH_H} overlay={(scale) => active && <NodePopover id={active} pinned={active === selected} scale={scale} onClose={() => onSelect(null)} />}>
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

const POPOVER_W = 360;

/** Rationale card anchored beside the active node, in unscaled (readable) pixels. Hover shows a
 *  preview that ignores the pointer; a click pins it with a close button. */
function NodePopover({ id, pinned, scale, onClose }: { id: string; pinned: boolean; scale: number; onClose: () => void }) {
  const node = NODES.find((n) => n.id === id);
  const detail = NODE_DETAILS[id];
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned, onClose]);
  if (!node || !detail) return null;
  const { x, y, w, h } = node.box;
  // Open to the right of the node unless that would overflow the canvas; then open to its left.
  const rightSide = (x + w) * scale + 12 + POPOVER_W <= ARCH_W * scale;
  const left = rightSide ? (x + w) * scale + 12 : Math.max(0, x * scale - 12 - POPOVER_W);
  // Nodes in the lower half grow the card upward so it never runs off the diagram.
  const vertical = y > ARCH_H / 2 ? { bottom: Math.max(0, (ARCH_H - y - h) * scale - 8) } : { top: Math.max(0, y * scale - 8) };
  return (
    <div className={`node-popover ${pinned ? 'pinned' : ''}`} role="dialog" aria-label={detail.heading}
      style={{ left, width: POPOVER_W, ...vertical }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'nowrap' }}>
        <div>
          <div className="popover-group">{detail.group}</div>
          <h4>{detail.heading}</h4>
        </div>
        {pinned && <button className="popover-close" onClick={onClose} aria-label="Close">✕</button>}
      </div>
      {detail.body.map((para, i) => <p key={i}>{para}</p>)}
      {!pinned && <div className="popover-hint">Click to pin</div>}
    </div>
  );
}
