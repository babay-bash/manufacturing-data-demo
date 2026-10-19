select source_system, source_id, entity_type, canonical_id from {{ source('raw', 'ref_source_id_crosswalk') }}
