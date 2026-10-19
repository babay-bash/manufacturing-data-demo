"""Tab 4: KPI dashboard. Every number is computed live from reporting.production_performance
(the one fact + conformed dimensions) using the canonical KPI definitions — nothing hard-coded."""

import altair as alt
import pandas as pd
import streamlit as st

from app import db
from app.kpis import Filters, fmt_value, kpi_query, load_kpis

# Categorical slots 1-3 of the validated reference palette, assigned to facilities in a
# fixed order so a filter never repaints a facility.
FACILITY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"]
SINGLE_SERIES = "#2a78d6"
CARD_KPIS = ["good_units", "variable_cost_per_good_unit", "oee", "scrap_rate", "energy_kwh_per_good_unit",
             "downtime_hours"]


@st.cache_data(show_spinner=False)
def _dims(_build_marker: float) -> dict[str, pd.DataFrame]:
    q = {
        "facility": "SELECT facility_id, facility_name FROM marts.dim_facility ORDER BY facility_id",
        "line": "SELECT line_id, line_name, facility_id FROM marts.dim_line ORDER BY line_id",
        "machine": "SELECT machine_id, line_id, facility_id, machine_type FROM marts.dim_machine ORDER BY machine_id",
        "product": "SELECT product_id, product_name FROM marts.dim_product ORDER BY product_id",
        "shift": "SELECT shift_code, shift_name FROM marts.dim_shift ORDER BY shift_code",
        "dates": "SELECT min(calendar_date) AS d0, max(calendar_date) AS d1 FROM marts.dim_date",
    }
    return {k: db.query_df(v) for k, v in q.items()}


def _run(filters: Filters, group_by=None, names=None) -> tuple[pd.DataFrame, str]:
    sql, params = kpi_query(filters, group_by, names)
    return db.query_df(sql, params), sql


def _filters(d: dict[str, pd.DataFrame]) -> Filters:
    fac = d["facility"]
    c = st.columns([2, 1.2, 1.2, 1.4, 1.6, 1])
    d0, d1 = d["dates"].iloc[0]["d0"], d["dates"].iloc[0]["d1"]
    rng = c[0].date_input("Date range", (d0, d1), min_value=d0, max_value=d1)
    facilities = c[1].multiselect("Facility", fac.facility_id, format_func=dict(zip(fac.facility_id, fac.facility_name)).get)
    lines_df = d["line"][d["line"].facility_id.isin(facilities)] if facilities else d["line"]
    lines = c[2].multiselect("Line", lines_df.line_id)
    m = d["machine"]
    m = m[m.facility_id.isin(facilities)] if facilities else m
    m = m[m.line_id.isin(lines)] if lines else m
    machines = c[3].multiselect("Machine", m.machine_id)
    prod = d["product"]
    products = c[4].multiselect("Product", prod.product_id, format_func=dict(zip(prod.product_id, prod.product_name)).get)
    shifts = c[5].multiselect("Shift", d["shift"].shift_code)
    start, end = (rng if isinstance(rng, (tuple, list)) and len(rng) == 2 else (d0, d1))
    return Filters(start, end, tuple(facilities), tuple(lines), tuple(machines), tuple(products), tuple(shifts))


def _bar(df, x, y, title, fmt, color=None, horizontal=False, facility_domain=None):
    enc_val = alt.X(f"{x}:Q", title=None, axis=alt.Axis(format=fmt)) if horizontal else alt.Y(f"{y}:Q", title=None, axis=alt.Axis(format=fmt))
    enc_cat = alt.Y(f"{y}:N", sort="-x", title=None, axis=alt.Axis(labelLimit=260)) if horizontal else alt.X(f"{x}:N", sort=None, title=None)
    value_field = x if horizontal else y
    chart = alt.Chart(df, title=title).mark_bar(cornerRadiusEnd=4, size=14 if horizontal else 28)
    color_enc = (alt.Color(f"{color}:N", scale=alt.Scale(domain=facility_domain, range=FACILITY_COLORS),
                           legend=alt.Legend(orient="bottom", title=None))
                 if color else alt.value(SINGLE_SERIES))
    tooltip = [c for c in df.columns if c != value_field] + [alt.Tooltip(f"{value_field}:Q", format=fmt)]
    return chart.encode(enc_val, enc_cat, color=color_enc, tooltip=tooltip)


def render() -> None:
    st.subheader("KPI dashboard")
    if not db.is_ready():
        st.warning("No curated data yet. Go to **② Pipeline** and click **Run pipeline**.")
        return
    kpis = load_kpis()
    dims = _dims(db.paths().serving_db.stat().st_mtime)
    f = _filters(dims)
    fac_domain = list(dims["facility"].facility_name)

    total, total_sql = _run(f)
    if total.empty or pd.isna(total.iloc[0]["good_units"]):
        st.info("No production matches these filters.")
        return
    cols = st.columns(len(CARD_KPIS))
    for col, name in zip(cols, CARD_KPIS):
        col.metric(kpis[name].label, fmt_value(kpis[name], total.iloc[0][name]), help=kpis[name].description)
    st.caption("Synthetic data. *Variable cost* is a proxy (material + energy only). All ratios are ratios of sums "
               "over the filtered rows of the single fact table.")

    by_fac, sql_fac = _run(f, ["facility_name"])
    daily, sql_daily = _run(f, ["calendar_date", "facility_name"], ["oee", "variable_cost_per_good_unit"])
    by_machine, sql_machine = _run(f, ["machine_id", "facility_name"], ["oee", "availability", "performance", "quality_rate"])
    by_product, sql_product = _run(f, ["product_name"], ["scrap_rate", "good_units"])
    by_line, sql_line = _run(f, ["line_id", "facility_name"], ["downtime_hours", "energy_kwh_per_good_unit"])

    c1, c2 = st.columns(2)
    with c1:
        st.altair_chart(_bar(by_fac, "facility_name", "variable_cost_per_good_unit", "Variable cost per good unit (USD)",
                             "$,.2f", color="facility_name", facility_domain=fac_domain), width="stretch")
    with c2:
        line = alt.Chart(daily, title="Daily OEE by facility").mark_line(strokeWidth=2).encode(
            alt.X("calendar_date:T", title=None),
            alt.Y("oee:Q", title=None, axis=alt.Axis(format=".0%"), scale=alt.Scale(zero=False)),
            alt.Color("facility_name:N", scale=alt.Scale(domain=fac_domain, range=FACILITY_COLORS),
                      legend=alt.Legend(orient="bottom", title=None)),
            tooltip=["calendar_date:T", "facility_name:N", alt.Tooltip("oee:Q", format=".1%"),
                     alt.Tooltip("variable_cost_per_good_unit:Q", format="$,.2f")])
        st.altair_chart(line, width="stretch")
    c3, c4 = st.columns(2)
    with c3:
        st.altair_chart(_bar(by_machine, "oee", "machine_id", "OEE by machine", ".0%", color="facility_name",
                             horizontal=True, facility_domain=fac_domain), width="stretch")
    with c4:
        st.altair_chart(_bar(by_product, "scrap_rate", "product_name", "Scrap rate by product", ".1%",
                             horizontal=True), width="stretch")
        st.altair_chart(_bar(by_line, "line_id", "downtime_hours", "Downtime hours by line", ",.0f",
                             color="facility_name", facility_domain=fac_domain), width="stretch")

    with st.expander("KPI definitions (from dbt_project.yml — shared with dbt)"):
        st.dataframe(pd.DataFrame([{"KPI": k.label, "SQL": k.sql, "Definition": k.description} for k in kpis.values()]),
                     hide_index=True, width="stretch")
    with st.expander("SQL behind these charts (paste into the SQL Explorer to reproduce)"):
        for title, sql in [("KPI cards", total_sql), ("By facility", sql_fac), ("Daily", sql_daily),
                           ("By machine", sql_machine), ("By product", sql_product), ("By line", sql_line)]:
            st.markdown(f"**{title}**")
            st.code(sql, language="sql")
        st.caption("Filter values are bound as `?` parameters.")
    with st.expander("Reconciliation: dashboard vs dbt-built reporting.kpi_overall (unfiltered)"):
        dash_all, _ = _run(Filters())
        dbt_all = db.query_df("SELECT * FROM reporting.kpi_overall")
        rows = []
        for name, k in kpis.items():
            a, b = float(dash_all.iloc[0][name]), float(dbt_all.iloc[0][name])
            rows.append({"KPI": k.label, "dashboard": fmt_value(k, a), "dbt reporting": fmt_value(k, b),
                         "match": "✅" if abs(a - b) <= 1e-9 * max(1.0, abs(b)) else "❌"})
        st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")
    with st.expander("Data table"):
        st.dataframe(by_machine, hide_index=True, width="stretch")
