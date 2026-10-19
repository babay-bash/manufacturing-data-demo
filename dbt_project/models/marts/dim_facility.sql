select facility_id, facility_name, country_code, timezone from {{ ref('stg_ref__facilities') }}
