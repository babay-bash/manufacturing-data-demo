-- What the pipeline quarantined, deduplicated or flagged — and how it was handled
SELECT * FROM reporting.data_quality_summary ORDER BY source, issue
