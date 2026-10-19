"""Headless smoke test of the Streamlit app and launcher."""

import subprocess
from pathlib import Path

from streamlit.testing.v1 import AppTest

REPO = Path(__file__).resolve().parents[2]


def test_app_renders_all_tabs_without_exceptions(built_home):
    at = AppTest.from_file(str(REPO / "app" / "main.py"), default_timeout=60).run()
    assert not at.exception, [e.value for e in at.exception]
    assert [t.label for t in at.tabs][:4] == ["① Design / Architecture", "② Pipeline", "③ SQL Explorer", "④ KPI Dashboard"]
    assert len(at.metric) == 6 and all(m.value not in ("", "n/a") for m in at.metric)


def test_sql_tab_blocks_mutation(built_home):
    at = AppTest.from_file(str(REPO / "app" / "main.py"), default_timeout=60).run()
    at.text_area(key="sql_text").set_value("drop table marts.dim_date").run()
    next(b for b in at.button if b.label == "Run query").click().run()
    assert any("SELECT" in e.value for e in at.error)


def test_launcher_is_valid_bash():
    subprocess.run(["bash", "-n", str(REPO / "start.command")], check=True)
