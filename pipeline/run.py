"""Pipeline orchestration: ingest -> dbt build (models + tests) -> promote.

Blue/green promotion: the run writes a fresh build database; only when
ingestion, every dbt model and every error-severity dbt test succeed is it
copied over the serving database the app reads. A failed run therefore never
leaves half-built or stale-looking tables behind — the app keeps showing the
last good build, clearly labelled with its timestamp, plus the failure.

CLI:  python -m pipeline.run [--reset]
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Callable

import duckdb

from pipeline.ingest import ingest
from pipeline.state import DBT_PROJECT_DIR, LANDED_DIR, Paths, append_history, paths, reset, run_lock

Event = Callable[[str, str], None]  # (kind, message); kind in {step, log, error}

# Layer-by-layer row counts shown in the Pipeline tab and stored with each run.
LINEAGE_COUNTS = {
    "raw.telemetry_machine_signals": "raw",
    "staging.stg_telemetry__machine_signals": "staging",
    "intermediate.int_telemetry__deduplicated": "intermediate",
    "raw.mes_production_orders": "raw",
    "intermediate.int_mes__operations": "intermediate",
    "marts.fct_production_performance": "marts",
    "quarantine.qtn_telemetry_events": "quarantine",
    "quarantine.qtn_qms_events": "quarantine",
}


def dbt_command(args: list[str], p: Paths) -> list[str]:
    """Invoke the real dbt CLI through the current interpreter (no console-script shim needed,
    which keeps the bundled release relocatable)."""
    return [sys.executable, "-c", "from dbt.cli.main import cli; cli()", *args,
            "--project-dir", str(DBT_PROJECT_DIR), "--profiles-dir", str(DBT_PROJECT_DIR),
            "--target-path", str(p.dbt_target), "--log-path", str(p.dbt_logs)]


def dbt_env(db_path) -> dict:
    env = dict(os.environ)
    env.update({"DEMO_DB_PATH": str(db_path), "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
                "DBT_VERSION_CHECK": "false", "DBT_USE_COLORS": "false", "DBT_PRINTER_WIDTH": "100",
                "PYTHONUNBUFFERED": "1"})
    return env


def run_dbt(args: list[str], p: Paths, on_event: Event) -> int:
    proc = subprocess.Popen(dbt_command(args, p), env=dbt_env(p.build_db), cwd=str(p.home),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    assert proc.stdout is not None
    for line in proc.stdout:
        on_event("log", line.rstrip())
    return proc.wait()


def summarize_run_results(p: Paths) -> dict:
    try:
        results = json.loads((p.dbt_target / "run_results.json").read_text())["results"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return {}
    summary: dict[str, int] = {}
    failures = []
    for r in results:
        kind = r["unique_id"].split(".")[0]
        key = f"{kind}:{r['status']}"
        summary[key] = summary.get(key, 0) + 1
        if r["status"] in ("error", "fail"):
            failures.append({"node": r["unique_id"], "message": (r.get("message") or "")[:500]})
    return {"by_status": summary, "failures": failures}


def lineage_counts(db_path) -> dict[str, int]:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        return {t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in LINEAGE_COUNTS}
    finally:
        con.close()


def promote(p: Paths) -> None:
    tmp = p.home / "warehouse.promoting"
    shutil.copy2(p.build_db, tmp)
    os.replace(tmp, p.serving_db)  # atomic swap; readers open a new connection per query


def run_pipeline(on_event: Event | None = None, landed_dir=LANDED_DIR) -> dict:
    """Run the whole pipeline once. Never raises for pipeline failures; returns a run record."""
    on_event = on_event or (lambda kind, msg: print(msg, flush=True))
    p = paths()
    record: dict = {"started_at": datetime.now(timezone.utc).isoformat(), "status": "running", "steps": []}
    t_start = time.perf_counter()

    def step(name: str, fn):
        on_event("step", name)
        t0 = time.perf_counter()
        out = fn()
        record["steps"].append({"step": name, "seconds": round(time.perf_counter() - t0, 2)})
        return out

    with run_lock(p):
        try:
            for f in (p.build_db, p.build_db.with_name("warehouse.duckdb.wal")):
                f.unlink(missing_ok=True)  # every run rebuilds from scratch -> idempotent
            ing = step("1. Python ingestion: landed files -> DuckDB raw",
                       lambda: ingest(p.build_db, landed_dir, log=lambda m: on_event("log", m)))
            record["batch_id"] = ing["batch_id"]
            rc = step("2. dbt build: staging -> intermediate -> marts + tests",
                      lambda: run_dbt(["build"], p, on_event))
            record["dbt"] = summarize_run_results(p)
            if rc != 0:
                raise RuntimeError(f"dbt build failed (exit code {rc}); see failures below. "
                                   "The previous successful build is still being served.")
            record["lineage_counts"] = step("3. Verify curated model", lambda: lineage_counts(p.build_db))
            step("4. Promote build to serving database", lambda: promote(p))
            record["status"] = "success"
        except Exception as exc:  # surfaced to the UI, never swallowed as success
            record["status"] = "failed"
            record["error"] = f"{type(exc).__name__}: {exc}"
            on_event("error", record["error"])
        finally:
            record["finished_at"] = datetime.now(timezone.utc).isoformat()
            record["elapsed_seconds"] = round(time.perf_counter() - t_start, 1)
            append_history(p, record)
    return record


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset(paths())
        print("Reset complete.")
    result = run_pipeline()
    print(json.dumps({k: v for k, v in result.items() if k != "steps"}, indent=2, default=str))
    sys.exit(0 if result["status"] == "success" else 1)
