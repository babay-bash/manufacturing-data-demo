select product_id, product_name, product_family, std_material_cost_usd, ideal_cycle_seconds
from {{ source('raw', 'ref_products') }}
