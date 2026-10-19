select e.*, 'UNKNOWN_OPERATION' as quarantine_reason
from {{ ref('int_erp__material_transactions') }} e
where e.operation_id not in (select operation_id from {{ ref('int_mes__operations') }})
