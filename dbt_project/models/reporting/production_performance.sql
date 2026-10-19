-- Stable, analyst-friendly interface: the fact with conformed dimension attributes.
-- The SQL Explorer and the dashboard both query this view.
select
    f.*,
    d.calendar_date, d.week_start_date, d.year_month, d.day_name,
    fa.facility_name, l.line_name, m.machine_type,
    p.product_name, p.product_family,
    s.shift_name
from {{ ref('fct_production_performance') }} f
join {{ ref('dim_date') }}     d  using (date_key)
join {{ ref('dim_facility') }} fa using (facility_id)
join {{ ref('dim_line') }}     l  on l.line_id = f.line_id
join {{ ref('dim_machine') }}  m  on m.machine_id = f.machine_id
join {{ ref('dim_product') }}  p  using (product_id)
join {{ ref('dim_shift') }}    s  using (shift_code)
