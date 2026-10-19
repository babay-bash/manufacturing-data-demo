select * from {{ ref('int_telemetry__aligned') }} where quarantine_reason = 'NO_TARIFF_FOR_DATE'
