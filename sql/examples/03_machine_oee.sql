-- Machine OEE = availability x performance x quality, each from SUMS (never averaged row ratios)
WITH m AS (
    SELECT
        machine_id, line_id, facility_name,
        sum(operating_minutes)::DOUBLE / nullif(sum(planned_minutes), 0)         AS availability,
        sum(ideal_run_seconds)::DOUBLE / nullif(sum(operating_minutes) * 60, 0)  AS performance,
        sum(good_units)::DOUBLE / nullif(sum(units_produced), 0)                 AS quality
    FROM reporting.production_performance
    GROUP BY ALL
)
SELECT *, round(availability * performance * quality, 3) AS oee
FROM m
ORDER BY oee
