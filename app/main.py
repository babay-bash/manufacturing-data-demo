"""Streamlit entry point: four tabs over one local DuckDB warehouse.

Run via ./start.command (reviewer) or `uv run streamlit run app/main.py` (developer).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # repo root, independent of cwd

import streamlit as st  # noqa: E402

from app import db  # noqa: E402
from app.tabs import dashboard, design, pipeline_panel, sql_explorer  # noqa: E402
from pipeline.state import is_running, load_history, paths  # noqa: E402

st.set_page_config(page_title="Manufacturing Data Platform Demo", page_icon="🏭", layout="wide")

st.markdown(
    """<style>
    .block-container {padding-top: 1.6rem; max-width: 1400px;}
    .demo-badge {display:inline-block; padding:2px 10px; border-radius:999px; font-size:0.78rem;
                 border:1px solid rgba(128,128,128,.45); margin-right:6px; color: inherit;}
    </style>""",
    unsafe_allow_html=True,
)

left, right = st.columns([3, 2])
with left:
    st.title("Plant & Field Data Platform")
    st.markdown(
        '<span class="demo-badge">Local demo — not production</span>'
        '<span class="demo-badge">100% synthetic data</span>'
        '<span class="demo-badge">Batch ELT: Python → DuckDB → dbt</span>',
        unsafe_allow_html=True,
    )
with right:
    p = paths()
    last_ok = next((r for r in reversed(load_history(p)) if r["status"] == "success"), None)
    if is_running(p):
        st.info("⏳ Pipeline run in progress…")
    elif db.is_ready() and last_ok:
        st.success(f"✅ Curated model ready — built {last_ok['finished_at'][:19].replace('T', ' ')} UTC")
    else:
        st.warning("⚪ Curated model not built yet — open **Pipeline** and click **Run pipeline**.")

tab_design, tab_pipeline, tab_sql, tab_dash = st.tabs(
    ["① Design / Architecture", "② Pipeline", "③ SQL Explorer", "④ KPI Dashboard"])
with tab_design:
    design.render()
with tab_pipeline:
    pipeline_panel.render()
with tab_sql:
    sql_explorer.render()
with tab_dash:
    dashboard.render()
