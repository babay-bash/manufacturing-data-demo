-- Normalizes units across gateway schema versions: v2 gateways (Stuttgart, from 2026-07-15)
-- report energy in Wh; everything downstream is kWh.
select
    event_id,
    source_tag,
    event_type,
    event_ts                as event_ts_utc,
    ingested_at             as ingested_at_utc,
    upper(quality_code)     as quality_code,
    schema_version,
    unit                    as source_unit,
    case when event_type = 'energy_interval_kwh' then
        case unit when 'kWh' then value_num when 'Wh' then value_num / 1000.0 end
    end                     as energy_kwh,
    case when event_type = 'machine_state' then upper(value_text) end as machine_state
from {{ source('raw', 'telemetry_machine_signals') }}
