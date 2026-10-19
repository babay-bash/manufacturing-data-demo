import math

from server.kpis import Filters, fmt_value, kpi_query, load_kpis


def test_kpis_are_ratios_of_sums_not_averages():
    for k in load_kpis().values():
        assert "avg(" not in k.sql.lower(), f"{k.name} averages row-level values"
        if "/" in k.sql and k.name != "downtime_hours":
            assert "nullif(" in k.sql, f"{k.name} is not zero-denominator safe"


def test_filter_values_are_bound_not_interpolated():
    f = Filters(facility_ids=("F-OH'; DROP TABLE x; --",), shift_codes=("DAY",))
    sql, params = kpi_query(f, ["facility_name"])
    assert "DROP TABLE" not in sql
    assert params == ["F-OH'; DROP TABLE x; --", "DAY"]
    assert "GROUP BY facility_name" in sql


def test_zero_denominator_formats_as_na():
    k = load_kpis()["variable_cost_per_good_unit"]
    assert fmt_value(k, None) == "n/a"
    assert fmt_value(k, math.nan) == "n/a"
