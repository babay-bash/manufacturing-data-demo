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
