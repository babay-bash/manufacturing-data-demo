"""Tab 1: the full production design, and — clearly separated — what this demo implements."""

from pathlib import Path

import streamlit as st

from app.components.mermaid import mermaid

DOCS = Path(__file__).resolve().parents[2] / "docs"


def _read(name: str) -> str:
    return (DOCS / name).read_text()


def render() -> None:
    st.subheader("Proposed production architecture")
    st.caption("The target platform recommended for the client. **None of these services run in this demo.**")
    src = _read("architecture.mmd")
    mermaid(src, height=560)
    with st.expander("Diagram source (docs/architecture.mmd — maintained as code)"):
        st.code(src, language="text")

    st.divider()
    st.subheader("What this demo actually implements")
    st.caption("Committed synthetic files stand in for data already landed in the raw lake. Real Python "
               "ingestion, real dbt models and tests, one local DuckDB file. No Kafka, S3, Snowflake, CDC or AI.")
    local = _read("local-flow.mmd")
    mermaid(local, height=480)
    with st.expander("Diagram source (docs/local-flow.mmd)"):
        st.code(local, language="text")

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("""
**Production → demo mapping**

| Production | In this demo |
|---|---|
| Edge gateway → Kafka → S3 raw | Committed Parquet/JSONL/CSV in `data/landed/` |
| Snowflake raw | DuckDB `raw` schema (Python snapshot load) |
| dbt on Snowflake | **Real dbt** on DuckDB (`dbt-duckdb`) |
| Semantic layer / metric store | KPI definitions in `dbt_project.yml` vars, shared by dbt and the dashboard |
| BI + governed AI answers | SQL Explorer + KPI Dashboard (no AI) |
""")
    with c2:
        st.markdown("""
**Known scope limitations (intentional)**

- Batch only — telemetry timestamps are real, but nothing streams.
- One work order per machine per shift (keeps joins 1:1; production needs allocation rules).
- Variable cost is a **proxy**: material + energy; no labor, overhead or depreciation.
- No auth, row-level security, document RAG or AI chat.
- Natural keys instead of surrogate/SCD2 keys (master data is static here).
""")

    st.divider()
    st.markdown(_read("design.md"))
    with st.expander("Decisions and trade-offs"):
        st.markdown(_read("decisions_and_tradeoffs.md"))
    with st.expander("AI assistance disclosure"):
        st.markdown(_read("ai_assistance.md"))
