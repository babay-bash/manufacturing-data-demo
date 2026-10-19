-- Machine-state intervals and energy aggregated to operation grain (one row per operation).
{% set iv = var('telemetry_interval_minutes') %}
select
    operation_id,
    count_if(quarantine_reason is null and machine_state = 'RUNNING') * {{ iv }} as operating_minutes,
    count_if(quarantine_reason is null and machine_state = 'IDLE')    * {{ iv }} as idle_minutes,
    count_if(quarantine_reason is null and machine_state = 'DOWN')    * {{ iv }} as downtime_minutes,
    count_if(quarantine_reason is null and event_type = 'machine_state')       as state_intervals,
    count_if(quarantine_reason is null and event_type = 'energy_interval_kwh') as energy_intervals,
    count_if(quarantine_reason = 'BAD_SENSOR_QUALITY')                         as bad_quality_energy_intervals,
    coalesce(sum(energy_kwh)      filter (where quarantine_reason is null), 0) as energy_kwh,
    coalesce(sum(energy_cost_usd) filter (where quarantine_reason is null), 0) as energy_cost_usd,
    count_if(is_late_arrival)                                                  as late_arriving_events,
    sum(delivery_count - 1)                                                    as duplicate_deliveries_removed
from {{ ref('int_telemetry__aligned') }}
where operation_id is not null
group by operation_id
