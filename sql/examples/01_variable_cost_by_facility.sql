-- Variable cost per good unit by facility (ERP material + telemetry energy priced at ERP tariff)
SELECT
    facility_name,
    sum(good_units)                                                      AS good_units,
    round(sum(material_cost_usd) / nullif(sum(good_units), 0), 2)       AS material_cost_per_good_unit,
    round(sum(energy_cost_usd)   / nullif(sum(good_units), 0), 4)       AS energy_cost_per_good_unit,
    round((sum(material_cost_usd) + sum(energy_cost_usd))
          / nullif(sum(good_units), 0), 2)                              AS variable_cost_per_good_unit
FROM reporting.production_performance
GROUP BY facility_name
ORDER BY variable_cost_per_good_unit DESC
