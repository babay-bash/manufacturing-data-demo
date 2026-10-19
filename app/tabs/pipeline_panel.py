"""Tab 2: run the real pipeline (Python ingestion + dbt build) and inspect the outcome."""

import json
import time

import pandas as pd
import streamlit as st

from app import db
from pipeline.fixtures import fixture_inventory
from pipeline.run import LINEAGE_COUNTS, run_pipeline
from pipeline.state import PipelineBusy, is_running, load_history, paths, reset

SCHEMA_COLORS = {"source": "#e8e8e3", "staging": "#cde2fb", "intermediate": "#9ec5f4",
                 "quarantine": "#f6c7b5", "marts": "#3987e5", "reporting": "#1baf7a"}


def _lineage_dot() -> str | None:
    """Model lineage graph from dbt's own manifest.json (not hand-drawn)."""
    try:
        manifest = json.loads((paths().dbt_target / "manifest.json").read_text())
    except FileNotFoundError:
        return None
    lines = ['digraph { rankdir=LR; node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=10];']
    for uid, node in manifest["nodes"].items():
        if node["resource_type"] != "model":
            continue
        color = SCHEMA_COLORS.get(node["schema"], "#eeeeee")
        font = "white" if node["schema"] in ("marts", "reporting") else "black"
        lines.append(f'"{node["name"]}" [fillcolor="{color}", fontcolor="{font}"];')
        for dep in node["depends_on"]["nodes"]:
            if dep.startswith("source."):
                src = dep.split(".")[-1]
                if not src.startswith("ref_"):
                    lines.append(f'"raw.{src}" [fillcolor="{SCHEMA_COLORS["source"]}"];')
                    lines.append(f'"raw.{src}" -> "{node["name"]}";')
            elif dep.startswith("model."):
                lines.append(f'"{dep.split(".")[-1]}" -> "{node["name"]}";')
    lines.append("}")
    return "\n".join(lines)


def _show_run(record: dict) -> None:
    ok = record["status"] == "success"
    (st.success if ok else st.error)(
        f"Last run **{record['status'].upper()}** in {record.get('elapsed_seconds', '?')}s "
        f"— finished {record.get('finished_at', '')[:19].replace('T', ' ')} UTC"
        + ("" if ok else f"\n\n{record.get('error', '')}"))
    if not ok and db.is_ready():
        st.info("The dashboard and SQL tab keep serving the **previous successful build**; "
                "nothing from the failed run was promoted.")
    c1, c2, c3 = st.columns([1.1, 0.8, 1.6])
    with c1:
        st.markdown("**Steps**")
        st.dataframe(pd.DataFrame(record.get("steps", [])), hide_index=True, width="stretch")
    with c2:
        st.markdown("**dbt results** (models, tests)")
        by_status = record.get("dbt", {}).get("by_status", {})
        st.dataframe(pd.DataFrame([{"node type : status": k, "count": v} for k, v in sorted(by_status.items())]),
                     hide_index=True, width="stretch")
    with c3:
        st.markdown("**Row counts by layer**")
        counts = record.get("lineage_counts") or {}
        st.dataframe(pd.DataFrame([{"layer": LINEAGE_COUNTS[t], "table": t, "rows": n} for t, n in counts.items()]),
                     hide_index=True, width="stretch")
    for f in record.get("dbt", {}).get("failures", []):
        st.error(f"`{f['node']}` — {f['message']}")


def render() -> None:
    p = paths()
    st.subheader("Pipeline control panel")
    st.caption("Runs **real** Python ingestion and the **real dbt CLI** (`dbt build` = models + tests) against a "
               "local DuckDB file. A run only replaces the served data if every model and test passes.")

    left, right = st.columns([1, 2])
    with left:
        run_clicked = st.button("▶ Run pipeline", type="primary", width="stretch", disabled=is_running(p))
        reset_clicked = st.button("↺ Reset (delete all built data)", width="stretch", disabled=is_running(p))
        st.caption(f"Writable data folder: `{p.home}`")
    with right:
        with st.expander("Landed source fixtures (synthetic, committed to the repo)", expanded=not db.is_ready()):
            st.dataframe(pd.DataFrame(fixture_inventory()), hide_index=True, width="stretch")

    if reset_clicked:
        try:
            reset(p)
            st.toast("Reset complete — the database is empty again.")
            time.sleep(0.6)
            st.rerun()
        except PipelineBusy as exc:
            st.warning(str(exc))

    if run_clicked:
        log_lines: list[str] = []
        with st.status("Running pipeline…", expanded=True) as status:
            log_box = st.empty()

            def on_event(kind: str, msg: str) -> None:
                if kind == "step":
                    status.update(label=msg)
                    log_lines.append(f"\n=== {msg} ===")
                else:
                    log_lines.append(msg)
                log_box.code("\n".join(log_lines[-400:]), language="text")

            try:
                record = run_pipeline(on_event)
            except PipelineBusy as exc:
                status.update(label=str(exc), state="error")
                return
            status.update(label=f"Pipeline {record['status']} in {record['elapsed_seconds']}s",
                          state="complete" if record["status"] == "success" else "error", expanded=False)
        st.session_state["last_run_log"] = "\n".join(log_lines)
        st.rerun()

    history = load_history(p)
    if not history:
        st.info("Database not yet populated. Click **Run pipeline** (about 10–20 seconds).")
        return
    _show_run(history[-1])

    if st.session_state.get("last_run_log"):
        with st.expander("Full log of the last run in this session (Python ingestion + dbt stdout)"):
            st.code(st.session_state["last_run_log"], language="text")
    if db.is_ready():
        st.markdown("#### Data quality: what was quarantined, deduplicated or flagged")
        st.dataframe(db.query_df("SELECT * FROM reporting.data_quality_summary ORDER BY source, issue"),
                     hide_index=True, width="stretch")
    dot = _lineage_dot()
    if dot:
        st.markdown("#### dbt model lineage (generated from dbt's manifest.json)")
        st.graphviz_chart(dot, width="stretch")
    with st.expander("Run history"):
        st.dataframe(pd.DataFrame([{k: r.get(k) for k in ("started_at", "status", "elapsed_seconds", "batch_id", "error")}
                                   for r in reversed(history)]), hide_index=True, width="stretch")
