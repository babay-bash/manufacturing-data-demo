-- One row per ERP goods-issue transaction: exact re-export replays collapse, and a later
-- correction (newer source_updated_at) supersedes the original amount.
select
    *,
    count(*) over (partition by transaction_id) as landed_versions
from {{ ref('stg_erp__material_costs') }}
qualify row_number() over (
    partition by transaction_id order by source_updated_at desc, _source_row desc) = 1
