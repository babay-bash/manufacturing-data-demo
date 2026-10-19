select line_id, facility_id, line_name from {{ source('raw', 'ref_lines') }}
