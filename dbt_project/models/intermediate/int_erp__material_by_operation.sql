-- Several transactions per operation are summed BEFORE joining to the fact (no fan-out).
select
    operation_id,
    sum(material_cost_usd) as material_cost_usd,
    count(*)               as material_transactions
from {{ ref('int_erp__material_transactions') }}
where operation_id in (select operation_id from {{ ref('int_mes__operations') }})
group by operation_id
