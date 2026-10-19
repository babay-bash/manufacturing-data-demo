-- Fact material cost equals deduplicated ERP transactions for known operations (to the cent).
select f.total, e.total
from (select sum(material_cost_usd) as total from {{ ref('fct_production_performance') }}) f,
     (select sum(material_cost_usd) as total from {{ ref('int_erp__material_transactions') }}
      where operation_id in (select operation_id from {{ ref('int_mes__operations') }})) e
where abs(f.total - e.total) > 0.01
