-- No row multiplication or loss: the fact has exactly one row per MES operation.
select (select count(*) from {{ ref('fct_production_performance') }}) as fact_rows,
       (select count(*) from {{ ref('int_mes__operations') }})        as mes_operations
where fact_rows <> mes_operations
