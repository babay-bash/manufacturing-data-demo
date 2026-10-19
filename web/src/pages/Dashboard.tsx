import { Check, Play, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '../api/client';
import type { Dashboard, DashboardFilters, Dims, KpiDefinition, KpiFormat, KpiName } from '../api/types';
import { useStatus } from '../components/status';
import { Card, DataTable, Disclosure, EmptyState, Tooltip } from '../components/ui';
import { FACILITY_COLORS, SINGLE_SERIES, fmtKpi } from '../lib/format';

const TILES: KpiName[] = ['variable_cost_per_good_unit', 'oee', 'scrap_rate', 'energy_kwh_per_good_unit', 'good_units'];
const FALLBACK_FMT: Record<string, KpiFormat> = { oee: 'pct', scrap_rate: 'pct', variable_cost_per_good_unit: 'usd', good_units: 'int', energy_kwh_per_good_unit: 'kwh' };

interface Filters { date_from: string; date_to: string; facility_id: string; line_id: string; product_id: string; shift_code: string }

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string }[] }) {
  return (
    <label className="field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}

export function DashboardPage({ go }: { go: (id: string) => void }) {
  const { status } = useStatus();
  const [dims, setDims] = useState<Dims | null>(null);
  const [defs, setDefs] = useState<KpiDefinition[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState<Filters>({ date_from: '', date_to: '', facility_id: '', line_id: '', product_id: '', shift_code: '' });
  const reqId = useRef(0);
  const ready = status?.ready;
  const buildKey = status?.last_success_at ?? '';

  useEffect(() => {
    if (!ready) return;
    api.dims().then((d) => { setDims(d); setF((x) => ({ ...x, date_from: d.date_min, date_to: d.date_max })); }).catch((e) => setError(e.message));
    api.kpiDefinitions().then(setDefs).catch(() => {});
  }, [ready, buildKey]);

  // Debounced fetch (300 ms); a request counter drops out-of-order responses.
  useEffect(() => {
    if (!ready || !dims) return;
    const body: DashboardFilters = {};
    (Object.keys(f) as (keyof Filters)[]).forEach((k) => { if (f[k]) body[k] = f[k]; });
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      api.dashboard(body)
        .then((d) => { if (id === reqId.current) { setData(d); setError(null); } })
        .catch((e) => { if (id === reqId.current) setError(e instanceof ApiError ? e.message : String(e)); })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [f, dims, ready, buildKey]);

  const facColor = useMemo(() => {
    const m: Record<string, string> = {};
    (dims?.facilities ?? []).forEach((fa, i) => { m[fa.id] = FACILITY_COLORS[i % FACILITY_COLORS.length]; });
    return m;
  }, [dims]);
  const defOf = (n: KpiName) => defs.find((d) => d.name === n);
  const fmt = (n: KpiName, v: number | null) => fmtKpi(v, defOf(n)?.fmt ?? FALLBACK_FMT[n] ?? 'int');

  if (status && !status.ready) {
    return (
      <>
        <div className="page-head"><h1>Dashboard</h1></div>
        <EmptyState title="No data to chart yet" action={<button className="btn primary" onClick={() => go('pipeline')}><Play size={15} />Go to Pipeline</button>}>
          Run the pipeline once to build the marts the dashboard reads.
        </EmptyState>
      </>
    );
  }
  if (!dims) return <div className="muted">{error ?? 'Loading…'}</div>;

  const set = (k: keyof Filters) => (v: string) => setF((x) => {
    const n = { ...x, [k]: v };
    if (k === 'facility_id' && n.line_id && !dims.lines.some((l) => l.id === n.line_id && (!v || l.facility_id === v))) n.line_id = '';
    return n;
  });
  const lineOpts = dims.lines.filter((l) => !f.facility_id || l.facility_id === f.facility_id);

  // Pivot daily rows to one row per date with a column per facility.
  const daily = (() => {
    const m = new Map<string, Record<string, number | string | null>>();
    data?.daily.forEach((r) => {
      const row = m.get(r.date) ?? { date: r.date };
      row[r.facility_id] = r.oee;
      m.set(r.date, row);
    });
    return [...m.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  })();
  const facilitiesShown = dims.facilities.filter((fa) => data?.daily.some((r) => r.facility_id === fa.id));
  const pct = (v: unknown) => fmtKpi(typeof v === 'number' ? v : null, 'pct');
  const usd = (v: unknown) => fmtKpi(typeof v === 'number' ? v : null, 'usd');
  const axis = { tickLine: false, axisLine: false } as const;

  const Legend = ({ items }: { items: { id: string; name: string }[] }) => (
    <div className="legend">{items.map((i) => <span key={i.id}><i style={{ background: facColor[i.id] }} />{i.name}</span>)}</div>
  );
  const byFac = (data?.by_facility ?? []).map((r) => ({ ...r }));
  const byLine = [...(data?.by_line ?? [])].sort((a, b) => (b.oee ?? -1) - (a.oee ?? -1));
  const byProd = [...(data?.by_product ?? [])].sort((a, b) => (b.scrap_rate ?? -1) - (a.scrap_rate ?? -1));
  const lineFacs = dims.facilities.filter((fa) => byLine.some((l) => l.facility_id === fa.id));

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="small muted" style={{ margin: 0 }}>Synthetic data · variable cost is a proxy (material + energy only)</p>
      </div>

      <Card className="filters">
        <label className="field">From<input type="date" value={f.date_from} min={dims.date_min} max={f.date_to || dims.date_max} onChange={(e) => set('date_from')(e.target.value)} /></label>
        <label className="field">To<input type="date" value={f.date_to} min={f.date_from || dims.date_min} max={dims.date_max} onChange={(e) => set('date_to')(e.target.value)} /></label>
        <Select label="Facility" value={f.facility_id} onChange={set('facility_id')} options={dims.facilities} />
        <Select label="Line" value={f.line_id} onChange={set('line_id')} options={lineOpts} />
        <Select label="Product" value={f.product_id} onChange={set('product_id')} options={dims.products} />
        <Select label="Shift" value={f.shift_code} onChange={set('shift_code')} options={dims.shifts} />
        {loading && <span className="small muted">Updating…</span>}
      </Card>

      {error && <div className="err" role="alert" style={{ marginTop: 16 }}>{error}</div>}

      <div className={loading ? 'loading' : ''}>
        <div className="kpis">
          {TILES.map((n) => (
            <Card key={n} className="tile">
              <div className="label"><span>{defOf(n)?.label ?? n}</span>{defOf(n) && <Tooltip text={defOf(n)!.description} />}</div>
              <div className="value">{data ? fmt(n, data.totals[n]) : '—'}</div>
            </Card>
          ))}
        </div>

        {data && (
          <div className="charts">
            <Card className="chart-card">
              <h3>Daily OEE by facility</h3>
              <div className="cap">Overall equipment effectiveness per day</div>
              <Legend items={facilitiesShown} />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={daily} margin={{ left: 0, right: 12, top: 6 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis {...axis} width={44} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} domain={['auto', 'auto']} />
                  <RTooltip formatter={(v) => pct(v)} labelFormatter={(l) => String(l)} contentStyle={{ borderRadius: 8, fontSize: 12.5 }} />
                  {facilitiesShown.map((fa) => (
                    <Line key={fa.id} name={fa.name} dataKey={fa.id} stroke={facColor[fa.id]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="chart-card">
              <h3>Variable cost per good unit</h3>
              <div className="cap">Product mix differs by facility: filter by product for like-for-like.</div>
              <Legend items={byFac.map((r) => ({ id: r.facility_id, name: r.facility_name }))} />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byFac} layout="vertical" margin={{ left: 0, right: 56, top: 6 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" {...axis} tickFormatter={(v: number) => `$${v}`} />
                  <YAxis type="category" dataKey="facility_name" {...axis} width={90} />
                  <RTooltip formatter={(v) => usd(v)} cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, fontSize: 12.5 }} />
                  <Bar dataKey="variable_cost_per_good_unit" name="Variable cost / good unit" barSize={30} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {byFac.map((r) => <Cell key={r.facility_id} fill={facColor[r.facility_id]} />)}
                    <LabelList dataKey="variable_cost_per_good_unit" position="right" formatter={(v: unknown) => usd(v)} style={{ fontSize: 12, fill: 'var(--text-2)' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="chart-card">
              <h3>OEE by line</h3>
              <div className="cap">Colored by facility</div>
              <Legend items={lineFacs} />
              <ResponsiveContainer width="100%" height={Math.max(200, 40 + byLine.length * 30)}>
                <BarChart data={byLine} layout="vertical" margin={{ left: 0, right: 48, top: 6 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" {...axis} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <YAxis type="category" dataKey="line_id" {...axis} width={70} />
                  <RTooltip formatter={(v) => pct(v)} cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, fontSize: 12.5 }} />
                  <Bar dataKey="oee" name="OEE" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {byLine.map((r) => <Cell key={r.line_id} fill={facColor[r.facility_id]} />)}
                    <LabelList dataKey="oee" position="right" formatter={(v: unknown) => pct(v)} style={{ fontSize: 12, fill: 'var(--text-2)' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="chart-card">
              <h3>Scrap rate by product</h3>
              <div className="cap">Share of units rejected</div>
              <ResponsiveContainer width="100%" height={Math.max(200, 40 + byProd.length * 30)}>
                <BarChart data={byProd} layout="vertical" margin={{ left: 0, right: 48, top: 6 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" {...axis} tickFormatter={(v: number) => `${+(v * 100).toFixed(1)}%`} />
                  <YAxis type="category" dataKey="product_name" {...axis} width={120} />
                  <RTooltip formatter={(v) => pct(v)} cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, fontSize: 12.5 }} />
                  <Bar dataKey="scrap_rate" name="Scrap rate" fill={SINGLE_SERIES} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    <LabelList dataKey="scrap_rate" position="right" formatter={(v: unknown) => pct(v)} style={{ fontSize: 12, fill: 'var(--text-2)' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>

      <section className="section">
        <Disclosure title="How these numbers are computed">
          <DataTable columns={['KPI', 'Format', 'Definition', 'SQL']} rows={defs.map((d) => [d.label, d.fmt, d.description, d.sql])} />
        </Disclosure>
        <Disclosure title="SQL behind these charts">
          {data && Object.entries(data.sql).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <div className="small muted" style={{ fontWeight: 600 }}>{k}</div>
              <pre className="log" style={{ height: 'auto', maxHeight: 240 }}>{v}</pre>
            </div>
          ))}
          {data && <p className="small muted">Bound parameters, in order (the <code>?</code> placeholders): {data.params.length ? data.params.map((p) => <code key={p} style={{ marginRight: 6 }}>{p}</code>) : 'none'}</p>}
        </Disclosure>
        <Disclosure title="Reconciliation with dbt">
          <p className="small muted">The dashboard's own SQL is compared with the dbt <code>reporting.kpi_overall</code> view.</p>
          {data && (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>KPI</th><th className="num">Dashboard</th><th className="num">dbt</th><th>Match</th></tr></thead>
                <tbody>
                  {data.reconciliation.map((r) => (
                    <tr key={r.name}>
                      <td>{r.label}</td><td className="num">{fmt(r.name, r.dashboard)}</td><td className="num">{fmt(r.name, r.dbt)}</td>
                      <td>{r.match ? <Check size={16} color="var(--ok)" aria-label="match" /> : <X size={16} color="var(--bad)" aria-label="mismatch" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Disclosure>
      </section>
    </>
  );
}
