-- Fact energy equals the sum of accepted (non-quarantined) deduplicated telemetry deltas.
select f.kwh, t.kwh
from (select sum(energy_kwh) as kwh from {{ ref('fct_production_performance') }}) f,
     (select sum(energy_kwh) as kwh from {{ ref('int_telemetry__aligned') }}
      where quarantine_reason is null) t
where abs(f.kwh - t.kwh) > 0.001
