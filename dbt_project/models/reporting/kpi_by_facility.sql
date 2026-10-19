select facility_id, facility_name, {{ kpi_select() }}
from {{ ref('production_performance') }}
group by all
order by facility_id
