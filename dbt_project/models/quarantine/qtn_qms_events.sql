select q.*, 'UNKNOWN_OPERATION' as quarantine_reason
from {{ ref('stg_qms__quality_events') }} q
where q.operation_id not in (select operation_id from {{ ref('int_mes__operations') }})
