-- At-least-once delivery means the same event_id can land more than once. Keep exactly one
-- row per stable event_id: the latest ingestion (a re-delivery may carry a corrected payload).
select
    *,
    count(*) over (partition by event_id)                         as delivery_count,
    ingested_at_utc - event_ts_utc
        > to_minutes({{ var('late_arrival_threshold_minutes') }}) as is_late_arrival
from {{ ref('stg_telemetry__machine_signals') }}
qualify row_number() over (partition by event_id order by ingested_at_utc desc) = 1
