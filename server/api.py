"""HTTP API for the React UI (contract: web/src/api/types.ts), plus static hosting of web/dist.

The API is deliberately thin: pipeline control delegates to pipeline.run, every metric comes
from the canonical KPI definitions (server.kpis), and user SQL goes through server.db's guard.
"""

from __future__ import annotations

import json
import math
import threading
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from pipeline.fixtures import fixture_inventory
from pipeline.run import run_pipeline
from pipeline.state import REPO_ROOT, PipelineBusy, is_running, load_history, paths, reset
from server import db
from server.kpis import Filters, kpi_query, load_kpis

WEB_DIST = REPO_ROOT / "web" / "dist"
EXAMPLES_DIR = REPO_ROOT / "sql" / "examples"

app = FastAPI(title="Trusted Data Foundation — local demo API", docs_url="/api/docs", openapi_url="/api/openapi.json")


# --------------------------------------------------------------------------- helpers
def _jsonable(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def _records(sql: str, params: list | None = None) -> list[dict]:
    con = db.connect()
    try:
        cur = con.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [{c: _jsonable(v) for c, v in zip(cols, row)} for row in cur.fetchall()]
    finally:
        con.close()


def _require_ready() -> None:
    if not db.is_ready():
        raise HTTPException(409, "The curated model has not been built yet. Run the pipeline first.")


# --------------------------------------------------------------------------- pipeline runs
class _RunState:
    """In-process progress buffer for the run started from the UI (the file lock in
    pipeline.state still guards against runs from other processes)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.lines: list[str] = []
        self.step: str | None = None
        self.record: dict | None = None
        self.thread: threading.Thread | None = None

    def on_event(self, kind: str, msg: str) -> None:
        with self.lock:
            if kind == "step":
                self.step = msg
                self.lines.append(f"=== {msg} ===")
            else:
                self.lines.append(msg if kind == "log" else f"ERROR: {msg}")

    def start(self) -> None:
        with self.lock:
            if (self.thread and self.thread.is_alive()) or is_running(paths()):
                raise PipelineBusy("A pipeline run is already in progress.")
            self.lines, self.step, self.record = [], None, None
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()

    def _run(self) -> None:
        try:
            record = run_pipeline(self.on_event)
        except PipelineBusy as exc:
            record = {"status": "failed", "error": str(exc), "steps": []}
        with self.lock:
            self.record = record

    @property
    def running(self) -> bool:
        return bool(self.thread and self.thread.is_alive())


RUN = _RunState()


@app.get("/api/status")
def status():
    p = paths()
    history = load_history(p)
    last_ok = next((r for r in reversed(history) if r["status"] == "success"), None)
    return {"ready": db.is_ready(), "running": RUN.running or is_running(p), "data_home": str(p.home),
            "last_run": history[-1] if history else None,
            "last_success_at": last_ok["finished_at"] if last_ok else None}


@app.get("/api/fixtures")
def fixtures():
    return fixture_inventory()


@app.post("/api/pipeline/run", status_code=202)
def pipeline_run():
    try:
        RUN.start()
    except PipelineBusy as exc:
        raise HTTPException(409, str(exc)) from None
    return {"started": True}


@app.get("/api/pipeline/progress")
def pipeline_progress(offset: int = 0):
    with RUN.lock:
        lines = RUN.lines[offset:]
        return {"running": RUN.running, "step": RUN.step, "lines": lines,
                "next_offset": offset + len(lines), "record": None if RUN.running else RUN.record}


@app.post("/api/pipeline/reset")
def pipeline_reset():
    if RUN.running:
        raise HTTPException(409, "Cannot reset while a pipeline run is in progress.")
    try:
        reset(paths())
    except PipelineBusy as exc:
        raise HTTPException(409, str(exc)) from None
    return {"ok": True}


@app.get("/api/pipeline/history")
def pipeline_history():
    return load_history(paths())


@app.get("/api/lineage")
def lineage():
    """Model graph straight from dbt's manifest.json (not hand-drawn)."""
    try:
        manifest = json.loads((paths().dbt_target / "manifest.json").read_text())
    except FileNotFoundError:
        return {"nodes": [], "edges": []}
    nodes, edges = {}, []
    for node in manifest["nodes"].values():
        if node["resource_type"] != "model":
            continue
        nodes[node["name"]] = node["schema"]
        for dep in node["depends_on"]["nodes"]:
            name = dep.split(".")[-1]
            if dep.startswith("source."):
                if name.startswith("ref_"):
                    continue  # master-data sources omitted to keep the graph legible
                name = f"raw.{name}"
                nodes[name] = "raw"
            edges.append({"from": name, "to": node["name"]})
    return {"nodes": [{"id": n, "layer": layer} for n, layer in sorted(nodes.items())], "edges": edges}


@app.get("/api/data-quality")
def data_quality():
    _require_ready()
    return _records("SELECT * FROM reporting.data_quality_summary ORDER BY source, issue")


# --------------------------------------------------------------------------- SQL explorer
@app.get("/api/sql/examples")
def sql_examples():
    out = []
    for f in sorted(EXAMPLES_DIR.glob("*.sql")):
        text = f.read_text()
        out.append({"id": f.stem, "title": text.splitlines()[0].lstrip("- ").strip(), "sql": text})
    return out


SQL_TABLES = [
    ("reporting", "production_performance", "The fact joined to every dimension attribute — start here."),
    ("marts", "fct_production_performance", "THE fact. Grain: machine × work-order operation × date × shift."),
    ("marts", "dim_date", "Calendar."), ("marts", "dim_facility", "3 facilities."), ("marts", "dim_line", "6 lines."),
    ("marts", "dim_machine", "18 machines."), ("marts", "dim_product", "8 products."), ("marts", "dim_shift", "Day / night."),
    ("reporting", "kpi_overall", "All canonical KPIs, unfiltered (built by dbt)."),
    ("reporting", "kpi_by_facility", "Canonical KPIs per facility."),
    ("reporting", "data_quality_summary", "What was quarantined, deduplicated or flagged."),
    ("quarantine", "qtn_telemetry_events", "Telemetry excluded from metrics, with reason."),
    ("quarantine", "qtn_qms_events", "QMS events for unknown operations."),
    ("quarantine", "qtn_erp_transactions", "ERP transactions for unknown operations."),
    ("staging / intermediate / raw", "*", "Every layer is inspectable."),
]


@app.get("/api/sql/tables")
def sql_tables():
    return [{"schema": s, "name": n, "description": d} for s, n, d in SQL_TABLES]


class SqlRequest(BaseModel):
    sql: str


@app.post("/api/sql")
def sql(req: SqlRequest):
    _require_ready()
    try:
        res = db.run_user_query(req.sql)
    except db.UnsafeQuery as exc:
        raise HTTPException(400, str(exc)) from None
    except Exception as exc:  # binder/catalog errors from DuckDB
        raise HTTPException(400, f"Query failed: {str(exc).splitlines()[0]}") from None
    rows = [[_jsonable(v) for v in row] for row in res.df.itertuples(index=False, name=None)]
    return {"columns": list(res.df.columns), "rows": rows, "row_count": len(rows),
            "truncated": res.truncated, "max_rows": db.MAX_ROWS, "seconds": round(res.seconds, 3)}


# --------------------------------------------------------------------------- dashboard
@app.get("/api/dims")
def dims():
    _require_ready()
    rng = _records("SELECT min(calendar_date) AS d0, max(calendar_date) AS d1 FROM marts.dim_date")[0]
    return {
        "facilities": _records("SELECT facility_id AS id, facility_name AS name FROM marts.dim_facility ORDER BY id"),
        "lines": _records("SELECT line_id AS id, line_name AS name, facility_id FROM marts.dim_line ORDER BY id"),
        "products": _records("SELECT product_id AS id, product_name AS name FROM marts.dim_product ORDER BY id"),
        "shifts": _records("SELECT shift_code AS id, shift_name AS name FROM marts.dim_shift ORDER BY id"),
        "date_min": rng["d0"], "date_max": rng["d1"],
    }


@app.get("/api/kpis/definitions")
def kpi_definitions():
    return [k.__dict__ for k in load_kpis().values()]


class DashboardFilters(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    facility_id: str | None = None
    line_id: str | None = None
    product_id: str | None = None
    shift_code: str | None = None


@app.post("/api/dashboard")
def dashboard(req: DashboardFilters):
    _require_ready()
    one = lambda v: (v,) if v else ()  # noqa: E731
    f = Filters(req.date_from, req.date_to, one(req.facility_id), one(req.line_id), (),
                one(req.product_id), one(req.shift_code))
    panels = {
        "totals": (None, None),
        "daily": (["calendar_date", "facility_id", "facility_name"], ["oee", "variable_cost_per_good_unit", "good_units"]),
        "by_facility": (["facility_id", "facility_name"],
                        ["variable_cost_per_good_unit", "material_cost_per_good_unit", "oee", "scrap_rate"]),
        "by_line": (["line_id", "facility_id", "facility_name"],
                    ["oee", "availability", "performance", "quality_rate", "downtime_hours"]),
        "by_product": (["product_id", "product_name"], ["scrap_rate", "good_units"]),
    }
    out: dict = {"sql": {}}
    params: list = []
    for name, (group_by, kpis) in panels.items():
        query, params = kpi_query(f, group_by, kpis)
        out["sql"][name] = query
        out[name] = _records(query, params)
    out["totals"] = out["totals"][0]
    for row in out["daily"]:
        row["date"] = row.pop("calendar_date")
    out["params"] = [str(p) for p in params]

    # Reconciliation: the dashboard's own unfiltered query vs the dbt-built reporting model.
    query, _ = kpi_query(Filters())
    mine, dbt = _records(query)[0], _records("SELECT * FROM reporting.kpi_overall")[0]
    out["reconciliation"] = [
        {"name": n, "label": k.label, "dashboard": mine[n], "dbt": dbt[n],
         "match": mine[n] is not None and dbt[n] is not None and abs(mine[n] - dbt[n]) <= 1e-9 * max(1.0, abs(dbt[n]))}
        for n, k in load_kpis().items()]
    return out


# --------------------------------------------------------------------------- static UI
if (WEB_DIST / "index.html").exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
else:
    @app.get("/", response_class=HTMLResponse)
    def missing_ui():
        return ("<h1>UI not built</h1><p>Run <code>cd web && npm install && npm run build</code>. "
                "The API is available under <a href='/api/docs'>/api/docs</a>.</p>")
