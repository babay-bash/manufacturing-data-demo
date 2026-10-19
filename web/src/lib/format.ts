import type { KpiFormat } from '../api/types';

export const DASH = '—';

/** Format a KPI value per its KpiFormat. Ratios (pct) are fractions, e.g. 0.742 -> 74.2%. null -> em dash. */
export function fmtKpi(v: number | null | undefined, fmt: KpiFormat): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  switch (fmt) {
    case 'int': return Math.round(v).toLocaleString('en-US');
    case 'usd': return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'pct': return `${(v * 100).toFixed(1)}%`;
    case 'kwh': return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
    case 'hours': return `${v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  }
}

export const fmtInt = (n: number | null | undefined) =>
  n === null || n === undefined ? DASH : n.toLocaleString('en-US');

export function fmtSeconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return DASH;
  return s < 100 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export const FACILITY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];
export const SINGLE_SERIES = '#2a78d6';
