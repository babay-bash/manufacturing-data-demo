/** dbt lineage drawn as layered columns by `layer`, with SVG edges. Hover a pill to highlight its full upstream/downstream chain. */
import { useMemo, useState } from 'react';
import type { Lineage } from '../api/types';

const LAYERS = ['raw', 'staging', 'intermediate', 'quarantine', 'marts', 'reporting'] as const;
const COL_W = 168;     // column pitch
const PILL_W = 148;
const PILL_H = 20;
const ROW = 25;        // vertical pitch per pill
const TOP = 30;        // room for the column header

/** Node ids may be dbt unique_ids ("model.pkg.name"); show only the last segment. */
const label = (id: string) => id.split('.').pop() ?? id;

export function LineageGraph({ data }: { data: Lineage }) {
  const [hover, setHover] = useState<string | null>(null);

  const { pos, width, height, cols } = useMemo(() => {
    const cols = LAYERS.map((l) => data.nodes.filter((n) => n.layer === l).map((n) => n.id).sort((a, b) => label(a).localeCompare(label(b))));
    const pos: Record<string, { x: number; y: number }> = {};
    cols.forEach((ids, ci) => ids.forEach((id, ri) => { pos[id] = { x: ci * COL_W + 4, y: TOP + ri * ROW }; }));
    const rows = Math.max(1, ...cols.map((c) => c.length));
    return { pos, cols, width: LAYERS.length * COL_W, height: TOP + rows * ROW + 6 };
  }, [data]);

  // Transitive closure up- and downstream of the hovered node.
  const lit = useMemo(() => {
    if (!hover) return null;
    const nodes = new Set([hover]);
    const walk = (dir: 'up' | 'down') => {
      const stack = [hover];
      while (stack.length) {
        const cur = stack.pop()!;
        data.edges.forEach((e) => {
          const [a, b] = dir === 'down' ? [e.from, e.to] : [e.to, e.from];
          if (a === cur && !nodes.has(b)) { nodes.add(b); stack.push(b); }
        });
      }
    };
    walk('up'); walk('down');
    return nodes;
  }, [hover, data.edges]);

  if (!data.nodes.length) return <p className="muted">No lineage yet. Run the pipeline first.</p>;

  return (
    <div className="lineage-wrap">
      <svg width={width} height={height} role="img" aria-label="dbt model lineage">
        {LAYERS.map((l, i) => (
          <text key={l} x={i * COL_W + 4} y={14} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-3)', textTransform: 'uppercase' }}>{l} ({cols[i].length})</text>
        ))}
        {data.edges.map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          const x1 = a.x + PILL_W, y1 = a.y + PILL_H / 2, x2 = b.x, y2 = b.y + PILL_H / 2;
          const mx = (x1 + x2) / 2;
          const on = lit ? lit.has(e.from) && lit.has(e.to) : false;
          return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none"
            stroke={on ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={on ? 1.8 : 1} opacity={lit && !on ? 0.12 : 0.8} />;
        })}
        {data.nodes.map((n) => {
          const p = pos[n.id];
          const on = !lit || lit.has(n.id);
          return (
            <g key={n.id} className="lin-node" transform={`translate(${p.x},${p.y})`} opacity={on ? 1 : 0.25}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
              <title>{n.id}</title>
              <rect width={PILL_W} height={PILL_H} rx={10} fill={n.layer === 'quarantine' ? 'var(--warn-soft)' : 'var(--surface)'}
                stroke={hover === n.id ? 'var(--accent)' : 'var(--border-strong)'} />
              <text x={8} y={14}>{label(n.id).length > 24 ? label(n.id).slice(0, 23) + '…' : label(n.id)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
