select shift_code, shift_name, local_start_time, duration_minutes from {{ source('raw', 'ref_shifts') }}
