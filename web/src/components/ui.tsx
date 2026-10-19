/** Small shared UI primitives: Card, Badge, Disclosure, Tooltip, DataTable, EmptyState. */
import { ChevronRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { DASH } from '../lib/format';

export function Card({ children, className = '', flat = false }: { children: ReactNode; className?: string; flat?: boolean }) {
  return <div className={`card ${flat ? 'flat' : ''} ${className}`}>{children}</div>;
}

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: '' | 'warn' | 'accent' | 'ok' | 'bad' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Disclosure({ title, children, defaultOpen = false, onToggle }: {
  title: ReactNode; children: ReactNode; defaultOpen?: boolean; onToggle?: (open: boolean) => void;
}) {
  return (
    <details className="disc" open={defaultOpen} onToggle={(e) => onToggle?.((e.target as HTMLDetailsElement).open)}>
      <summary><ChevronRight size={16} className="chev" />{title}</summary>
      <div className="disc-body">{children}</div>
    </details>
  );
}

/** (i) icon with a hover/focus popover. */
export function Tooltip({ text }: { text: string }) {
  return (
    <span className="tip">
      <button type="button" className="tip-btn" aria-label={text}><Info size={14} /></button>
      <span className="tip-pop" role="tooltip">{text}</span>
    </span>
  );
}

export type Cell = string | number | boolean | null | undefined;

export function DataTable({ columns, rows, className = '', mono = false }: {
  columns: string[]; rows: Cell[][]; className?: string; mono?: boolean;
}) {
  return (
    <div className={`table-wrap ${className}`}>
      <table className="t">
        <thead><tr>{columns.map((c, i) => <th key={i} className={rows.length && typeof rows[0][i] === 'number' ? 'num' : ''}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((v, ci) => {
                const isNum = typeof v === 'number';
                return (
                  <td key={ci} className={`${isNum ? 'num' : ''} ${mono ? 'mono' : ''}`}>
                    {v === null || v === undefined ? <span className="muted">{DASH}</span>
                      : isNum ? v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="empty" >
      <div style={{ textAlign: 'center', padding: '28px 12px' }}>
        <h2>{title}</h2>
        <div className="muted" style={{ marginBottom: 16 }}>{children}</div>
        {action}
      </div>
    </Card>
  );
}
