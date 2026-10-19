select
    facility_id,
    effective_from,
    effective_to,
    cast(usd_per_kwh as decimal(8, 4)) as usd_per_kwh
from {{ source('raw', 'erp_energy_tariffs') }}
