-- Weekly trend by shift: output, scrap rate and downtime
SELECT
    week_start_date,
    shift_code,
    sum(units_produced)                                          AS units_produced,
    round(sum(rejected_units) / nullif(sum(units_produced), 0), 4) AS scrap_rate,
    round(sum(downtime_minutes) / 60.0, 1)                       AS downtime_hours
FROM reporting.production_performance
GROUP BY ALL
ORDER BY week_start_date, shift_code
