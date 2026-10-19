-- All canonical KPIs over the full period (used to reconcile the dashboard).
select {{ kpi_select() }}
from {{ ref('fct_production_performance') }}
