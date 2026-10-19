"""Canonical KPI definitions, read from the same dbt_project.yml vars that dbt uses.

Keeping one definition means the dashboard, the SQL examples and the dbt
reporting models cannot drift apart; tests/integration/test_reconciliation.py
proves the dashboard query reproduces reporting.kpi_overall exactly.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import yaml

from pipeline.state import DBT_PROJECT_DIR

SOURCE_VIEW = "reporting.production_performance"


@dataclass(frozen=True)
class Kpi:
    name: str
    label: str
    fmt: str
    sql: str
    description: str


@lru_cache(maxsize=1)
def load_kpis() -> dict[str, Kpi]:
    project = yaml.safe_load((DBT_PROJECT_DIR / "dbt_project.yml").read_text())
    return {k["name"]: Kpi(**k) for k in project["vars"]["kpis"]}


def kpi_select(names: list[str] | None = None) -> str:
    kpis = load_kpis()
    return ",\n    ".join(f"{kpis[n].sql} AS {n}" for n in (names or kpis))


@dataclass
class Filters:
    date_from: object = None
    date_to: object = None
    facility_ids: tuple = ()
    line_ids: tuple = ()
    machine_ids: tuple = ()
    product_ids: tuple = ()
    shift_codes: tuple = ()

    def where(self) -> tuple[str, list]:
        """Parameterized WHERE clause; values are bound, never interpolated."""
        clauses, params = [], []
        if self.date_from:
            clauses.append("calendar_date >= ?")
            params.append(self.date_from)
        if self.date_to:
            clauses.append("calendar_date <= ?")
            params.append(self.date_to)
        for col, values in (("facility_id", self.facility_ids), ("line_id", self.line_ids),
                            ("machine_id", self.machine_ids), ("product_id", self.product_ids),
                            ("shift_code", self.shift_codes)):
            if values:
                clauses.append(f"{col} IN ({', '.join('?' * len(values))})")
                params.extend(values)
        return ("WHERE " + " AND ".join(clauses)) if clauses else "", params


def kpi_query(filters: Filters, group_by: list[str] | None = None, names: list[str] | None = None) -> tuple[str, list]:
    where, params = filters.where()
    dims = ", ".join(group_by or [])
    sql = f"SELECT {dims + ', ' if dims else ''}{kpi_select(names)}\nFROM {SOURCE_VIEW}\n{where}"
    if dims:
        sql += f"\nGROUP BY {dims}\nORDER BY {dims}"
    return sql, params


def fmt_value(kpi: Kpi, value) -> str:
    if value is None or value != value:  # None or NaN (zero denominator)
        return "n/a"
    return {"int": f"{value:,.0f}", "usd": f"${value:,.2f}", "pct": f"{value:.1%}",
            "kwh": f"{value:,.3f} kWh", "hours": f"{value:,.0f} h"}.get(kpi.fmt, f"{value:,.2f}")
