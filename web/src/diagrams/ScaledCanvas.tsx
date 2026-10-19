/** Renders children on a fixed design canvas (w x h) and scales it to the container width.
 *  The outer box takes the scaled height so surrounding layout flows correctly. */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScaledCanvas({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1.25, el.clientWidth / w));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} className="canvas-outer" style={{ height: h * scale }}>
      <div className="canvas-inner" style={{ width: w, height: h, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

/** Port on a node edge: returns a point. frac moves it along the side. */
export interface Box { x: number; y: number; w: number; h: number }
export type Side = 'l' | 'r' | 't' | 'b';

export function port(b: Box, side: Side, frac = 0.5): { x: number; y: number } {
  switch (side) {
    case 'l': return { x: b.x, y: b.y + b.h * frac };
    case 'r': return { x: b.x + b.w, y: b.y + b.h * frac };
    case 't': return { x: b.x + b.w * frac, y: b.y };
    case 'b': return { x: b.x + b.w * frac, y: b.y + b.h };
  }
}

/** Smooth cubic bezier between two ports. Control handles extend perpendicular to the side the edge leaves/enters,
 *  with length proportional to the distance (so short hops stay tight and long hops stay smooth). */
export function bezier(a: { x: number; y: number }, sa: Side, b: { x: number; y: number }, sb: Side): string {
  const d = Math.max(30, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
  const vec = (s: Side) => (s === 'r' ? [1, 0] : s === 'l' ? [-1, 0] : s === 'b' ? [0, 1] : [0, -1]);
  const [ax, ay] = vec(sa);
  const [bx, by] = vec(sb);
  return `M${a.x},${a.y} C${a.x + ax * d},${a.y + ay * d} ${b.x + bx * d},${b.y + by * d} ${b.x},${b.y}`;
}
