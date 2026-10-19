-- At most one tariff per facility and date, so the effective-date join cannot fan out.
select a.facility_id, a.effective_from, b.effective_from
from {{ ref('stg_erp__energy_tariffs') }} a
join {{ ref('stg_erp__energy_tariffs') }} b
  on a.facility_id = b.facility_id and a.effective_from < b.effective_from
 and b.effective_from <= a.effective_to
