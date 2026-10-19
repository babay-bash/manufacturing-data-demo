select
    m.machine_id, m.machine_type, m.rated_kw, m.line_id, l.facility_id,
    x.source_id as telemetry_source_tag
from {{ ref('stg_ref__machines') }} m
join {{ ref('stg_ref__lines') }} l using (line_id)
left join {{ ref('stg_ref__source_id_crosswalk') }} x
    on x.canonical_id = m.machine_id and x.source_system = 'TELEMETRY_HISTORIAN'
