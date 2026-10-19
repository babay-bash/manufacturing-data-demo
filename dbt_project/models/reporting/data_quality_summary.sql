-- What the pipeline excluded or repaired, and why. Deterministic counts for the demo fixtures.
select 'telemetry' as source, quarantine_reason as issue, 'quarantined' as handling, count(*) as events
from {{ ref('qtn_telemetry_events') }} group by all
union all
select 'telemetry', 'DUPLICATE_DELIVERY', 'deduplicated by event_id (latest ingestion kept)',
       sum(delivery_count - 1) from {{ ref('int_telemetry__deduplicated') }}
union all
select 'telemetry', 'LATE_ARRIVAL (>' || {{ var('late_arrival_threshold_minutes') }} || ' min)',
       'included (batch recompute)', count_if(is_late_arrival) from {{ ref('int_telemetry__deduplicated') }}
union all
select 'qms', quarantine_reason, 'quarantined', count(*) from {{ ref('qtn_qms_events') }} group by all
union all
select 'erp', 'DUPLICATE_OR_CORRECTED_TRANSACTION', 'latest version per transaction_id kept',
       sum(landed_versions - 1) from {{ ref('int_erp__material_transactions') }}
union all
select 'erp', quarantine_reason, 'quarantined', count(*) from {{ ref('qtn_erp_transactions') }} group by all
union all
select 'mes', 'ZERO_GOOD_UNIT_OPERATION', 'kept; ratios are NULL-safe', count(*)
from {{ ref('fct_production_performance') }} where good_units = 0
