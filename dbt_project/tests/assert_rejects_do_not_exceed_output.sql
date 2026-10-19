-- QMS cannot reject more distinct units than MES says were produced.
select r.operation_id
from {{ ref('int_qms__rejects_by_operation') }} r
join {{ ref('int_mes__operations') }} o using (operation_id)
where r.rejected_units > o.units_produced
