"""Tab 3: read-only SQL over the curated model."""

from pathlib import Path

import streamlit as st

from app import db

EXAMPLES_DIR = Path(__file__).resolve().parents[2] / "sql" / "examples"


def _examples() -> dict[str, str]:
    out = {}
    for f in sorted(EXAMPLES_DIR.glob("*.sql")):
        text = f.read_text()
        title = text.splitlines()[0].lstrip("- ").strip()
        out[title] = text
    return out


def render() -> None:
    st.subheader("SQL Explorer")
    if not db.is_ready():
        st.warning("Curated tables are not available yet. Go to **② Pipeline** and click **Run pipeline**.")
        return
    st.caption(f"Read-only DuckDB connection · one SELECT / WITH…SELECT statement · first {db.MAX_ROWS:,} rows · "
               f"{db.TIMEOUT_SECONDS}s limit · file access disabled.")

    examples = _examples()
    choice = st.selectbox("Example queries", list(examples), key="sql_example")
    if st.session_state.get("_loaded_example") != choice:
        st.session_state["sql_text"] = examples[choice]
        st.session_state["_loaded_example"] = choice
    sql = st.text_area("SQL", key="sql_text", height=260)

    with st.expander("Tables you can query"):
        st.markdown("""
- `reporting.production_performance` — the fact joined to all dimension attributes (start here)
- `marts.fct_production_performance` — **the** fact (grain: machine × work-order operation × date × shift)
- `marts.dim_date`, `dim_facility`, `dim_line`, `dim_machine`, `dim_product`, `dim_shift`
- `reporting.kpi_overall`, `reporting.kpi_by_facility`, `reporting.data_quality_summary`
- `quarantine.qtn_telemetry_events`, `qtn_qms_events`, `qtn_erp_transactions`
- `staging.*`, `intermediate.*`, `raw.*` — every layer is inspectable
""")

    if st.button("Run query", type="primary"):
        try:
            res = db.run_user_query(sql)
        except db.UnsafeQuery as exc:
            st.error(f"🚫 {exc}")
            return
        except Exception as exc:  # DuckDB binder/catalog errors etc.
            st.error(f"Query failed: {str(exc).splitlines()[0]}")
            return
        msg = f"{len(res.df):,} rows · {res.seconds:.2f}s"
        if res.truncated:
            msg += f" · truncated to the first {db.MAX_ROWS:,} rows"
        st.caption(msg)
        st.dataframe(res.df, hide_index=True, width="stretch")
        st.download_button("Download CSV", res.df.to_csv(index=False).encode(), "query_result.csv", "text/csv")
