select facility_id, facility_name, country_code, timezone from {{ source('raw', 'ref_facilities') }}
