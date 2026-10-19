"""API smoke tests through FastAPI's TestClient (same routes the React UI calls)."""

import subprocess
from pathlib import Path

from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]


def client():
    from server.api import app
    return TestClient(app)


def test_status_and_dashboard(built_home):
    c = client()
    s = c.get("/api/status").json()
    assert s["ready"] and not s["running"] and s["last_run"]["status"] == "success"
    d = c.post("/api/dashboard", json={"facility_id": "F-MX"}).json()
    assert d["params"] == ["F-MX"] and {r["facility_id"] for r in d["by_line"]} == {"F-MX"}
    assert all(r["match"] for r in d["reconciliation"])
    assert len(c.get("/api/dims").json()["facilities"]) == 3


def test_sql_endpoint_allows_select_and_blocks_mutation(built_home):
    c = client()
    ok = c.post("/api/sql", json={"sql": "select count(*) as n from marts.fct_production_performance"})
    assert ok.status_code == 200 and ok.json()["rows"][0][0] > 0
    bad = c.post("/api/sql", json={"sql": "drop table marts.dim_date"})
    assert bad.status_code == 400 and "SELECT" in bad.json()["detail"]


def test_lineage_and_quality_come_from_the_build(built_home):
    c = client()
    lin = c.get("/api/lineage").json()
    assert "fct_production_performance" in {n["id"] for n in lin["nodes"]}
    assert {r["issue"] for r in c.get("/api/data-quality").json()} >= {"BAD_SENSOR_QUALITY", "UNMAPPED_SOURCE_TAG"}


def test_launcher_is_valid_bash():
    subprocess.run(["bash", "-n", str(REPO / "start.command")], check=True)


def test_concurrent_requests_do_not_fail(built_home):
    """Regression: overlapping requests used to 500 because a later connection tried to SET
    options on a DuckDB instance whose configuration another connection had locked."""
    from concurrent.futures import ThreadPoolExecutor

    c = client()
    calls = [lambda: c.post("/api/dashboard", json={}), lambda: c.get("/api/dims"),
             lambda: c.get("/api/data-quality"), lambda: c.post("/api/sql", json={"sql": "select 1"})] * 6
    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = [f.result().status_code for f in [pool.submit(fn) for fn in calls]]
    assert codes == [200] * len(calls)


def test_overlapping_connections_share_locked_utc_config(built_home):
    from server import db

    first = db.connect()
    second = db.connect()  # instance config already locked by `first`
    try:
        assert second.execute("SELECT current_setting('TimeZone')").fetchone()[0] == "UTC"
        assert second.execute("SELECT current_setting('lock_configuration')").fetchone()[0] is True
    finally:
        first.close()
        second.close()
