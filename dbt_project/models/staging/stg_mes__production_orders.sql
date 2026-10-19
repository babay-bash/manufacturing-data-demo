select
    operation_id,
    work_order_id,
    site_code,
    machine_code            as source_machine_code,
    product_code            as product_id,
    production_date,
    upper(shift_code)       as shift_code,
    shift_start_utc,
    shift_end_utc,
    scheduled_minutes,
    units_produced,
    ideal_cycle_seconds,
    source_updated_at,
    _batch_id
from {{ source('raw', 'mes_production_orders') }}
