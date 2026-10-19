"""Shared fixtures. Every test gets an isolated DEMO_HOME; the full pipeline runs once per session."""

import json
import os
import sys
from pathlib import Path

import duckdb
import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

MANIFEST = json.loads((REPO / "data" / "landed" / "_manifest.json").read_text())


@pytest.fixture(scope="session")
def built_home(tmp_path_factory):
    """Run the real pipeline (Python ingestion + dbt build) once into a temporary home."""
    home = tmp_path_factory.mktemp("demo_home")
    os.environ["DEMO_HOME"] = str(home)
    from pipeline.run import run_pipeline

    record = run_pipeline(on_event=lambda kind, msg: None)
    assert record["status"] == "success", record.get("error")
    return home


@pytest.fixture
def con(built_home):
    c = duckdb.connect(str(built_home / "warehouse.duckdb"), read_only=True)
    yield c
    c.close()


@pytest.fixture
def manifest():
    return MANIFEST
