with bounds as (
    select min(production_date) as d0, max(production_date) as d1 from {{ ref('int_mes__operations') }}
)
select
    cast(strftime(d, '%Y%m%d') as integer) as date_key,
    cast(d as date)                        as calendar_date,
    dayname(d)                             as day_name,
    isodow(d) >= 6                         as is_weekend,
    cast(date_trunc('week', d) as date)    as week_start_date,
    strftime(d, '%Y-%m')                   as year_month
from bounds, generate_series(d0, d1, interval 1 day) as g(d)
