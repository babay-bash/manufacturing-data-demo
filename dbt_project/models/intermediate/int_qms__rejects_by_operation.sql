-- Rejected units = DISTINCT unit serials: one unit can carry several defect events, and
-- counting events would double count scrap.
select
    q.operation_id,
    count(distinct q.unit_serial) as rejected_units,
    count(*)                      as defect_events
from {{ ref('stg_qms__quality_events') }} q
where q.operation_id in (select operation_id from {{ ref('int_mes__operations') }})
group by q.operation_id
