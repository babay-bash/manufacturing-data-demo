-- Quality hot spots: line x product x month scrap rate, with QMS defect mix
WITH scrap AS (
    SELECT line_id, product_name, year_month,
           sum(rejected_units) AS rejected_units, sum(units_produced) AS units_produced,
           round(sum(rejected_units) / nullif(sum(units_produced), 0), 4) AS scrap_rate
    FROM reporting.production_performance
    GROUP BY ALL
)
SELECT * FROM scrap
WHERE units_produced > 0
ORDER BY scrap_rate DESC
LIMIT 15
