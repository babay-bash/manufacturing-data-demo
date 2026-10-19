-- Energy intensity (kWh per good unit) by product and facility
SELECT
    product_name, facility_name,
    round(sum(energy_kwh) / nullif(sum(good_units), 0), 3) AS kwh_per_good_unit,
    sum(good_units)                                         AS good_units
FROM reporting.production_performance
GROUP BY ALL
ORDER BY kwh_per_good_unit DESC
