select
    event_id                as quality_event_id,
    operation_id,
    unit_serial,
    upper(defect_code)      as defect_code,
    upper(disposition)      as disposition,
    event_ts                as event_ts_utc,
    source_updated_at
from {{ source('raw', 'qms_quality_events') }}
