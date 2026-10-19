# KPI definitions

Canonical KPI definitions live under `vars: kpis:` in `dbt_project/dbt_project.yml`. The SQL
column below is copied exactly from that file. Every KPI is computed over
`marts.fct_production_performance` (exposed as `reporting.production_performance`), and every
column it references is an additive base measure in the fact. All data are synthetic.

| KPI (column) | Label | Exact SQL | Numerator | Denominator | Source systems | Caveat |
|---|---|---|---|---|---|---|
| `good_units` | Good units | `sum(good_units)` | sum of good units (units produced minus distinct QMS-rejected units) | none (count) | MES (units_produced), QMS (rejected unit serials) | Count, not a ratio. Units with a quality hold (all units rejected) contribute 0 |
| `variable_cost_per_good_unit` | Variable cost / good unit | `(sum(material_cost_usd) + sum(energy_cost_usd)) / nullif(sum(good_units), 0)` | material cost (ERP) + energy cost (telemetry priced at ERP tariff) | good units | ERP (material cost, tariffs), Telemetry (energy), MES and QMS (good units) | **Proxy.** Excludes labor, overhead and depreciation. Energy is priced at the tariff valid on the interval's local date |
| `material_cost_per_good_unit` | Material cost / good unit | `sum(material_cost_usd) / nullif(sum(good_units), 0)` | ERP goods-issue material cost | good units | ERP, MES and QMS (good units) | Rejected units also consume material, so scrap raises this KPI. Based on goods-issue postings, not standard cost |
| `oee` | OEE | `(sum(operating_minutes) / nullif(sum(planned_minutes), 0)) * (sum(ideal_run_seconds) / nullif(sum(operating_minutes) * 60, 0)) * (sum(good_units) / nullif(sum(units_produced), 0))` | Availability numerator x Performance numerator x Quality numerator (operating minutes, ideal run seconds, good units) | Each factor's own denominator: planned minutes, operating minutes x 60, units produced | Telemetry (operating minutes), MES (planned minutes, ideal run seconds, units produced), QMS (good units) | Product of three ratios of sums (see Availability, Performance and Yield below). Inherits the caveats of each component |
| `availability` | Availability | `sum(operating_minutes) / nullif(sum(planned_minutes), 0)` | RUNNING minutes from telemetry | MES scheduled minutes | Telemetry, MES | Telemetry state is 15-minute sampled, so minutes are multiples of 15. Planned-maintenance shifts are absent from MES and therefore excluded from the denominator. Shifts with no MES row produce no telemetry in the fact |
| `performance` | Performance | `sum(ideal_run_seconds) / nullif(sum(operating_minutes) * 60, 0)` | ideal cycle seconds x units produced | operating minutes x 60 | MES (ideal_cycle_seconds, units_produced), Telemetry (operating minutes) | Can exceed 100% if telemetry under-reports operating time. The warn-severity dbt test `performance_not_above_100pct` flags such rows; the KPI is **not capped** |
| `quality_rate` | Yield (quality rate) | `sum(good_units) / nullif(sum(units_produced), 0)` | good units | units produced (MES) | MES, QMS | Yield at the distinct unit-serial level. Rejected units are counted once even when a unit carries several defect codes |
| `scrap_rate` | Scrap rate | `sum(rejected_units) / nullif(sum(units_produced), 0)` | distinct rejected units (QMS) | units produced (MES) | QMS, MES | Only events whose operation exists in MES are counted. Orphan QMS events are quarantined and excluded |
| `energy_kwh_per_good_unit` | Energy / good unit | `sum(energy_kwh) / nullif(sum(good_units), 0)` | deduplicated, non-quarantined telemetry energy (kWh) | good units | Telemetry (energy deltas, Wh converted to kWh in staging), MES and QMS (good units) | Only energy from accepted events counts. Events quarantined as bad quality, unmapped or without a tariff are excluded from the numerator |
| `downtime_hours` | Downtime | `sum(downtime_minutes) / 60.0` | telemetry DOWN minutes | none (hours) | Telemetry | Based on DOWN intervals only. IDLE time is not downtime in this definition |

Notes:

- `oee`, `availability`, `performance` and `quality_rate` use the same numerators and denominators as
  their standalone rows. OEE equals availability x performance x quality by construction.
- The SQL uses `nullif(..., 0)`, so a zero denominator returns NULL. The dashboard renders NULL as `n/a`
  (`app/kpis.py::fmt_value`).

---

## Why ratios of sums

- **Never average row-level ratios.** Each fact row is one operation, and operations differ in size.
  An average of per-operation percentages gives a 10-unit shift the same weight as a 1,000-unit shift.
  The canonical KPIs instead divide the total numerator by the total denominator, so every unit, minute
  or dollar carries equal weight.
- **Zero denominators become NULL, not zero or infinity.** `nullif(denominator, 0)` makes an
  all-outage slice return NULL, which is then shown as `n/a`. Quality holds and full outages therefore
  reduce the sums without breaking the ratio.
- **Performance above 100% is flagged, not capped.** A value above 1.0 usually points to a data problem (for
  example, telemetry under-reporting operating time relative to ideal cycle times). The warn-severity dbt test
  `performance_not_above_100pct` on `fct_production_performance` reports it without failing the build.
  Capping would hide the problem.

---

## Where definitions live

1. **`dbt_project/dbt_project.yml`, `vars: kpis:`.** The single source of truth. Each entry has `name`,
   `label`, `fmt`, `sql` and `description`.
2. **`dbt_project/macros/kpis.sql`, macro `kpi_select()`.** Renders every entry in `var('kpis')` as
   `{{ k.sql }} as {{ k.name }}` for the select list.
3. **`dbt_project/models/reporting/kpi_overall.sql`** (one row, all periods) and
   **`dbt_project/models/reporting/kpi_by_facility.sql`** (one row per facility, grouped from
   `production_performance`) call `kpi_select()`.
4. **`app/kpis.py`** reads the same YAML (`load_kpis()`, via `yaml.safe_load` on `dbt_project.yml`) and
   builds the dashboard query with `kpi_query()`, which selects the same SQL from
   `reporting.production_performance` with bound filter parameters. The SQL tab and dashboard therefore
   use the same expressions as the reporting models.
5. **Reconciliation test:** `tests/integration/test_pipeline_outputs.py::test_canonical_metrics_reconcile_dashboard_with_dbt`
   checks that the dashboard query matches `reporting.kpi_overall` for every KPI (relative tolerance 1e-9),
   and that the Monterrey (`F-MX`) OEE matches `reporting.kpi_by_facility`.

To change a KPI, edit the YAML entry and rebuild. The macro, the reporting views, the dashboard and the
reconciliation test all follow from it.
