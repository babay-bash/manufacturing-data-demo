select l.line_id, l.line_name, l.facility_id, f.facility_name
from {{ ref('stg_ref__lines') }} l
join {{ ref('stg_ref__facilities') }} f using (facility_id)
