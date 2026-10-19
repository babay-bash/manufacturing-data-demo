select shift_code, shift_name, local_start_time, duration_minutes from {{ ref('stg_ref__shifts') }}
