-- Event-level telemetry mapped to canonical machines, aligned to the MES operation whose
-- shift window [start, end) contains the event time, and priced with the ERP tariff valid on
-- the event's LOCAL facility date (a night shift crossing a tariff change is priced per interval).
-- Every event gets a quarantine_reason or NULL; nothing is dropped by an inner join.
with ev as (
    select * from {{ ref('int_telemetry__deduplicated') }}
),
tag_xwalk as (
    select source_id, canonical_id
    from {{ ref('stg_ref__source_id_crosswalk') }}
    where source_system = 'TELEMETRY_HISTORIAN' and entity_type = 'machine'
),
mapped as (
    select ev.*, x.canonical_id as machine_id, l.facility_id, f.timezone
    from ev
    left join tag_xwalk x                         on x.source_id = ev.source_tag
    left join {{ ref('stg_ref__machines') }} m    on m.machine_id = x.canonical_id
    left join {{ ref('stg_ref__lines') }} l       on l.line_id = m.line_id
    left join {{ ref('stg_ref__facilities') }} f  on f.facility_id = l.facility_id
),
aligned as (
    select
        mapped.*,
        o.operation_id,
        {{ local_date('mapped.event_ts_utc', 'mapped.timezone') }} as local_event_date
    from mapped
    left join {{ ref('int_mes__operations') }} o
        on  o.machine_id = mapped.machine_id
        and mapped.event_ts_utc >= o.shift_start_utc
        and mapped.event_ts_utc <  o.shift_end_utc
)
select
    a.event_id,
    a.source_tag,
    a.event_type,
    a.event_ts_utc,
    a.ingested_at_utc,
    a.local_event_date,
    a.machine_id,
    a.facility_id,
    a.operation_id,
    a.quality_code,
    a.schema_version,
    a.machine_state,
    a.energy_kwh,
    t.usd_per_kwh,
    a.energy_kwh * t.usd_per_kwh as energy_cost_usd,
    a.delivery_count,
    a.is_late_arrival,
    case
        when a.machine_id is null                      then 'UNMAPPED_SOURCE_TAG'
        when a.quality_code <> 'GOOD'                  then 'BAD_SENSOR_QUALITY'
        when a.operation_id is null                    then 'NO_MATCHING_OPERATION'
        when a.event_type = 'energy_interval_kwh'
         and t.usd_per_kwh is null                     then 'NO_TARIFF_FOR_DATE'
    end as quarantine_reason
from aligned a
left join {{ ref('stg_erp__energy_tariffs') }} t
    on  t.facility_id = a.facility_id
    and a.local_event_date between t.effective_from and t.effective_to
