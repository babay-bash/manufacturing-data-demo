-- THE production performance fact.
-- Grain: one row per facility x line x machine x work-order operation x calendar date x shift
--        (operation_id is the grain key; MES is the spine, so every operation appears once).
-- Every source is pre-aggregated to operation grain before joining -> joins are 1:1 and can
-- never multiply cost or energy. Only additive base measures are stored; ratios (OEE, cost per
-- unit, ...) are computed from sums via the canonical KPI definitions in dbt_project.yml.
with ops as (select * from {{ ref('int_mes__operations') }}),
tel as (select * from {{ ref('int_telemetry__by_operation') }}),
qms as (select * from {{ ref('int_qms__rejects_by_operation') }}),
erp as (select * from {{ ref('int_erp__material_by_operation') }})
select
    -- keys
    ops.operation_id,
    ops.work_order_id,                                   -- degenerate dimension
    cast(strftime(ops.production_date, '%Y%m%d') as integer) as date_key,
    ops.facility_id,
    ops.line_id,
    ops.machine_id,
    ops.product_id,
    ops.shift_code,
    ops.shift_start_utc,
    ops.shift_end_utc,
    -- additive measures: output and quality (MES + QMS)
    ops.units_produced,
    coalesce(qms.rejected_units, 0)                      as rejected_units,
    ops.units_produced - coalesce(qms.rejected_units, 0) as good_units,
    coalesce(qms.defect_events, 0)                       as defect_events,
    -- additive measures: time (MES plan + telemetry states)
    ops.planned_minutes,
    coalesce(tel.operating_minutes, 0)                   as operating_minutes,
    coalesce(tel.idle_minutes, 0)                        as idle_minutes,
    coalesce(tel.downtime_minutes, 0)                    as downtime_minutes,
    ops.ideal_run_seconds,
    -- additive measures: energy and cost (telemetry + ERP)
    coalesce(tel.energy_kwh, 0)                          as energy_kwh,
    cast(coalesce(tel.energy_cost_usd, 0) as decimal(14, 2)) as energy_cost_usd,
    cast(coalesce(erp.material_cost_usd, 0) as decimal(14, 2)) as material_cost_usd,
    cast(coalesce(erp.material_cost_usd, 0) + coalesce(tel.energy_cost_usd, 0) as decimal(14, 2))
                                                         as variable_cost_usd,
    -- data-quality and lineage attributes
    coalesce(tel.state_intervals, 0)                     as telemetry_state_intervals,
    coalesce(tel.bad_quality_energy_intervals, 0)        as bad_quality_energy_intervals,
    coalesce(tel.late_arriving_events, 0)                as late_arriving_events,
    coalesce(tel.duplicate_deliveries_removed, 0)        as duplicate_deliveries_removed,
    coalesce(erp.material_transactions, 0)               as material_transactions,
    ops.units_produced > 0
        and ops.units_produced - coalesce(qms.rejected_units, 0) = 0 as is_quality_hold,
    ops._batch_id                                        as ingestion_batch_id,
    current_timestamp                                    as built_at_utc
from ops
left join tel using (operation_id)
left join qms using (operation_id)
left join erp using (operation_id)
