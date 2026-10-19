-- One row per MES operation (= machine x production date x shift; demo simplification:
-- a machine runs exactly one work order per shift). Resolves legacy Monterrey MES machine
-- codes to canonical machine IDs and attaches the conformed line/facility hierarchy.
with mes as (
    select * from {{ ref('stg_mes__production_orders') }}
),
mes_xwalk as (
    select source_id, canonical_id
    from {{ ref('stg_ref__source_id_crosswalk') }}
    where source_system = 'MES_MTY' and entity_type = 'machine'
)
select
    mes.operation_id,
    mes.work_order_id,
    coalesce(x.canonical_id, mes.source_machine_code) as machine_id,
    m.line_id,
    l.facility_id,
    f.timezone                                        as facility_timezone,
    mes.product_id,
    mes.production_date,
    mes.shift_code,
    mes.shift_start_utc,
    mes.shift_end_utc,
    mes.scheduled_minutes                             as planned_minutes,
    mes.units_produced,
    mes.ideal_cycle_seconds,
    mes.ideal_cycle_seconds * mes.units_produced      as ideal_run_seconds,
    mes._batch_id
from mes
left join mes_xwalk x                       on x.source_id = mes.source_machine_code
left join {{ ref('stg_ref__machines') }} m  on m.machine_id = coalesce(x.canonical_id, mes.source_machine_code)
left join {{ ref('stg_ref__lines') }} l     on l.line_id = m.line_id
left join {{ ref('stg_ref__facilities') }} f on f.facility_id = l.facility_id
