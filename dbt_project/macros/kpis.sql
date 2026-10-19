{# Render every canonical KPI from var('kpis') as select-list expressions. #}
{% macro kpi_select() -%}
    {%- for k in var('kpis') %}
    {{ k.sql }} as {{ k.name }}{{ "," if not loop.last }}
    {%- endfor %}
{%- endmacro %}

{# Local wall-clock date of a UTC timestamptz in an IANA time zone column. #}
{% macro local_date(ts, tz_col) -%}
    cast(timezone({{ tz_col }}, {{ ts }}) as date)
{%- endmacro %}
