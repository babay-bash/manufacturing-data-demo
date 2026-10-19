-- Kept at landed grain (duplicates included) so deduplication is visible and tested downstream.
select
    transaction_id,
    operation_id,
    work_order_id,
    cast(material_cost as decimal(14, 2)) as material_cost_usd,
    upper(currency)         as currency,
    posting_ts              as posting_ts_utc,
    source_updated_at,
    _source_row
from {{ source('raw', 'erp_material_costs') }}
