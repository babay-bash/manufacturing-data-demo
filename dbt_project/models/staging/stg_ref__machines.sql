select machine_id, line_id, machine_type, rated_kw from {{ source('raw', 'ref_machines') }}
