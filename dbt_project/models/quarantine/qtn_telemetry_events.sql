-- Telemetry events excluded from curated metrics, with the reason. Visible in the app.
select * from {{ ref('int_telemetry__aligned') }} where quarantine_reason is not null
