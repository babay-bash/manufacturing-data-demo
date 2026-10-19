"""Behavior of the curated model built by the real pipeline, checked against the fixture manifest."""

from decimal import Decimal


def one(con, sql):
    return con.execute(sql).fetchone()[0]


def test_one_fact_six_dimensions(con):
    tables = {r[0] for r in con.execute(
        "select table_name from information_schema.tables where table_schema = 'marts'").fetchall()}
    assert {t for t in tables if t.startswith("fct_")} == {"fct_production_performance"}
    assert {t for t in tables if t.startswith("dim_")} == {
        "dim_date", "dim_facility", "dim_line", "dim_machine", "dim_product", "dim_shift"}


def test_fact_grain_has_no_row_multiplication(con, manifest):
    assert one(con, "select count(*) from marts.fct_production_performance") == manifest["mes_operations"]
    assert one(con, "select count(distinct operation_id) from marts.fct_production_performance") == manifest["mes_operations"]


def test_telemetry_duplicates_collapse_to_unique_events(con, manifest):
    assert one(con, "select count(*) from raw.telemetry_machine_signals") == manifest["telemetry_rows_landed"]
    assert one(con, "select count(*) from intermediate.int_telemetry__deduplicated") == manifest["telemetry_unique_events"]


def test_anomalies_are_quarantined_with_expected_counts(con, manifest):
    q = dict(con.execute("select quarantine_reason, count(*) from quarantine.qtn_telemetry_events group by 1").fetchall())
    assert q == {"BAD_SENSOR_QUALITY": manifest["telemetry_bad_quality_events"],
                 "UNMAPPED_SOURCE_TAG": manifest["telemetry_unmapped_events"]}
    assert one(con, "select count(*) from quarantine.qtn_qms_events") == manifest["qms_orphan_events"]
    assert one(con, "select count(*) from quarantine.qtn_erp_transactions") == 0


def test_late_and_out_of_order_events_are_included(con, manifest):
    assert one(con, "select count_if(is_late_arrival) from intermediate.int_telemetry__deduplicated") \
        == manifest["telemetry_late_events_after_dedupe"]
    late_quarantined = one(con, """select count(*) from quarantine.qtn_telemetry_events q
        join intermediate.int_telemetry__deduplicated d using (event_id)
        where d.is_late_arrival and q.quarantine_reason not in ('BAD_SENSOR_QUALITY','UNMAPPED_SOURCE_TAG')""")
    assert late_quarantined == 0


def test_rejected_units_count_distinct_serials(con, manifest):
    assert one(con, "select sum(rejected_units) from marts.fct_production_performance") == manifest["qms_rejected_units"]
    assert one(con, "select sum(defect_events) from marts.fct_production_performance") > manifest["qms_rejected_units"]


def test_erp_replays_and_corrections_resolved(con, manifest):
    total = one(con, "select sum(material_cost_usd) from marts.fct_production_performance")
    assert total == Decimal(str(manifest["erp_material_cost_after_dedupe"]))


def test_zero_good_unit_operations_are_kept_and_null_safe(con, manifest):
    assert one(con, "select count(*) from marts.fct_production_performance where good_units = 0") \
        == manifest["zero_good_unit_operations"]
    row = con.execute("""select (sum(material_cost_usd)+sum(energy_cost_usd))/nullif(sum(good_units),0)
                         from marts.fct_production_performance where good_units = 0""").fetchone()
    assert row[0] is None


def test_tariff_applies_by_local_date_across_a_rate_change(con):
    """Dayton night shift 2026-06-30 18:00 local crosses into 2026-07-01, when the rate changes."""
    op = one(con, """select operation_id from marts.fct_production_performance f
                     join marts.dim_date d using (date_key)
                     where facility_id = 'F-OH' and shift_code = 'NIGHT' and calendar_date = '2026-06-30'
                     order by operation_id limit 1""")
    rates = dict(con.execute(f"""select local_event_date, any_value(usd_per_kwh)
        from intermediate.int_telemetry__aligned
        where operation_id = '{op}' and event_type = 'energy_interval_kwh' and quarantine_reason is null
        group by 1""").fetchall())
    assert {str(d) for d in rates} == {"2026-06-30", "2026-07-01"}
    assert {float(r) for r in rates.values()} == {0.082, 0.094}
    expected = one(con, f"""select sum(energy_kwh * usd_per_kwh) from intermediate.int_telemetry__aligned
                            where operation_id = '{op}' and quarantine_reason is null""")
    actual = one(con, f"select energy_cost_usd from marts.fct_production_performance where operation_id = '{op}'")
    assert abs(float(actual) - expected) < 0.01


def test_wh_readings_from_v2_gateways_are_normalized(con):
    before, after = con.execute("""
        select avg(energy_kwh) filter (where event_ts_utc <  '2026-07-10'),
               avg(energy_kwh) filter (where event_ts_utc >= '2026-07-20')
        from intermediate.int_telemetry__aligned
        where facility_id = 'F-DE' and event_type = 'energy_interval_kwh' and quarantine_reason is null""").fetchone()
    assert 0.5 < after / before < 2.0


def test_canonical_metrics_reconcile_dashboard_with_dbt(built_home):
    from server import db
    from server.kpis import Filters, kpi_query, load_kpis

    sql, params = kpi_query(Filters())
    dash = db.query_df(sql, params).iloc[0]
    dbt = db.query_df("select * from reporting.kpi_overall").iloc[0]
    for name in load_kpis():
        assert abs(float(dash[name]) - float(dbt[name])) <= 1e-9 * max(1.0, abs(float(dbt[name]))), name

    sql, params = kpi_query(Filters(facility_ids=("F-MX",)))
    mx = db.query_df(sql, params).iloc[0]
    mx_dbt = db.query_df("select * from reporting.kpi_by_facility where facility_id = 'F-MX'").iloc[0]
    assert abs(float(mx["oee"]) - float(mx_dbt["oee"])) < 1e-12


def test_oee_components_are_plausible(con):
    av, perf, q = con.execute("""select sum(operating_minutes)/sum(planned_minutes),
        sum(ideal_run_seconds)/(sum(operating_minutes)*60), sum(good_units)/sum(units_produced)
        from marts.fct_production_performance""").fetchone()
    assert 0 < av <= 1 and 0 < perf <= 1 and 0 < q <= 1


def test_user_query_timeout_and_row_cap(built_home):
    import pytest

    from server import db

    res = db.run_user_query("select * from range(100000)", max_rows=100)
    assert len(res.df) == 100 and res.truncated
    with pytest.raises(db.UnsafeQuery, match="time limit"):
        db.run_user_query("select count(*) from range(10000000) a, range(100000) b", timeout=0.5)


def test_connection_is_read_only_even_if_guard_is_bypassed(built_home):
    import duckdb
    import pytest

    from server import db

    c = db.connect()
    with pytest.raises(duckdb.Error):
        c.execute("delete from marts.dim_shift")
    with pytest.raises(duckdb.Error):
        c.execute("select * from read_csv('/etc/hosts')")
    c.close()
