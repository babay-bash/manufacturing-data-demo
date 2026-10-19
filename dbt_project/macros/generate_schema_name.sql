{# Use the configured schema name as-is (staging, marts, ...) instead of dbt's default
   "<target_schema>_<custom>" prefixing, so the SQL tab shows clean schema names. #}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {{ (custom_schema_name or target.schema) | trim }}
{%- endmacro %}
