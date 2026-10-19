"""Run-level behavior: idempotence, failure handling and promotion. Each test uses its own home."""

import shutil

import duckdb

from pipeline.run import run_pipeline
from pipeline.state import LANDED_DIR, load_history, paths, reset

SILENT = lambda kind, msg: None  # noqa: E731


def snapshot(db_path):
    c = duckdb.connect(str(db_path), read_only=True)
    try:
        tables = c.execute("""select table_schema || '.' || table_name from information_schema.tables
                              where table_schema in ('raw','staging','intermediate','quarantine','marts','reporting')
                              order by 1""").fetchall()
        counts = {t: c.execute(f"select count(*) from {t}").fetchone()[0] for (t,) in tables}
        kpis = c.execute("select * from reporting.kpi_overall").fetchall()
        return counts, kpis
    finally:
        c.close()


def test_rerun_is_idempotent_and_reset_works(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_HOME", str(tmp_path))
    assert run_pipeline(SILENT)["status"] == "success"
    first = snapshot(paths().serving_db)
    assert run_pipeline(SILENT)["status"] == "success"
    assert snapshot(paths().serving_db) == first
    reset(paths())
    assert not paths().serving_db.exists() and load_history(paths()) == []


def _broken_landed(tmp_path, mutate):
    landed = tmp_path / "landed"
    shutil.copytree(LANDED_DIR, landed)
    mutate(landed)
    return landed


def test_contract_failure_reports_failed_and_promotes_nothing(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_HOME", str(tmp_path / "home"))
    landed = _broken_landed(tmp_path, lambda d: (d / "qms" / "quality_events.jsonl").write_text(""))
    rec = run_pipeline(SILENT, landed_dir=landed)
    assert rec["status"] == "failed" and "empty" in rec["error"]
    assert not paths().serving_db.exists()
    assert load_history(paths())[-1]["status"] == "failed"


def test_dbt_test_failure_keeps_previous_good_build(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_HOME", str(tmp_path / "home"))
    assert run_pipeline(SILENT)["status"] == "success"
    before_mtime = paths().serving_db.stat().st_mtime_ns

    def overlap_tariff(d):
        with (d / "erp" / "energy_tariffs.csv").open("a") as f:
            f.write("F-OH,2026-06-15,2026-07-15,0.5\n")  # overlaps -> tariff join would fan out

    rec = run_pipeline(SILENT, landed_dir=_broken_landed(tmp_path, overlap_tariff))
    assert rec["status"] == "failed"
    failed_nodes = " ".join(f["node"] for f in rec["dbt"]["failures"])
    assert "assert_tariff_periods_do_not_overlap" in failed_nodes
    assert paths().serving_db.stat().st_mtime_ns == before_mtime  # stale-but-labelled, never half-built
