"""Source contracts for the landed fixture files.

Each contract names the landed file (relative to data/landed), the raw table it
loads into and the exact columns/types expected. Ingestion validates files
against these contracts before loading anything, so a malformed drop fails
loudly instead of producing a partially loaded raw layer.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import pyarrow.parquet as pq

from pipeline.state import LANDED_DIR


@dataclass(frozen=True)
class SourceContract:
    name: str            # raw table name (schema raw)
    path: str            # relative to data/landed
    fmt: str             # csv | jsonl | parquet
    columns: dict[str, str]  # column -> DuckDB type
    source_system: str


CONTRACTS: list[SourceContract] = [
    SourceContract("mes_production_orders", "mes/production_orders.csv", "csv", {
        "operation_id": "VARCHAR", "work_order_id": "VARCHAR", "site_code": "VARCHAR",
        "machine_code": "VARCHAR", "product_code": "VARCHAR", "production_date": "DATE",
        "shift_code": "VARCHAR", "shift_start_utc": "TIMESTAMPTZ", "shift_end_utc": "TIMESTAMPTZ",
        "scheduled_minutes": "INTEGER", "units_produced": "INTEGER", "ideal_cycle_seconds": "INTEGER",
        "source_updated_at": "TIMESTAMPTZ"}, "MES"),
    SourceContract("qms_quality_events", "qms/quality_events.jsonl", "jsonl", {
        "event_id": "VARCHAR", "operation_id": "VARCHAR", "unit_serial": "VARCHAR",
        "defect_code": "VARCHAR", "disposition": "VARCHAR", "event_ts": "TIMESTAMPTZ",
        "source_updated_at": "TIMESTAMPTZ"}, "QMS"),
    SourceContract("erp_material_costs", "erp/material_costs.csv", "csv", {
        "transaction_id": "VARCHAR", "operation_id": "VARCHAR", "work_order_id": "VARCHAR",
        "material_cost": "DECIMAL(14,2)", "currency": "VARCHAR", "posting_ts": "TIMESTAMPTZ",
        "source_updated_at": "TIMESTAMPTZ"}, "ERP"),
    SourceContract("erp_energy_tariffs", "erp/energy_tariffs.csv", "csv", {
        "facility_id": "VARCHAR", "effective_from": "DATE", "effective_to": "DATE",
        "usd_per_kwh": "DECIMAL(8,4)"}, "ERP"),
    SourceContract("telemetry_machine_signals", "telemetry/machine_signals.parquet", "parquet", {
        "event_id": "VARCHAR", "source_tag": "VARCHAR", "event_type": "VARCHAR",
        "event_ts": "TIMESTAMPTZ", "ingested_at": "TIMESTAMPTZ", "value_num": "DOUBLE",
        "value_text": "VARCHAR", "unit": "VARCHAR", "quality_code": "VARCHAR",
        "schema_version": "SMALLINT"}, "TELEMETRY_HISTORIAN"),
    SourceContract("ref_facilities", "reference/facilities.csv", "csv", {
        "facility_id": "VARCHAR", "facility_name": "VARCHAR", "country_code": "VARCHAR",
        "timezone": "VARCHAR"}, "MASTER_DATA"),
    SourceContract("ref_lines", "reference/lines.csv", "csv", {
        "line_id": "VARCHAR", "facility_id": "VARCHAR", "line_name": "VARCHAR"}, "MASTER_DATA"),
    SourceContract("ref_machines", "reference/machines.csv", "csv", {
        "machine_id": "VARCHAR", "line_id": "VARCHAR", "machine_type": "VARCHAR",
        "rated_kw": "DOUBLE"}, "MASTER_DATA"),
    SourceContract("ref_products", "reference/products.csv", "csv", {
        "product_id": "VARCHAR", "product_name": "VARCHAR", "product_family": "VARCHAR",
        "std_material_cost_usd": "DECIMAL(10,2)", "ideal_cycle_seconds": "INTEGER"}, "MASTER_DATA"),
    SourceContract("ref_shifts", "reference/shifts.csv", "csv", {
        "shift_code": "VARCHAR", "shift_name": "VARCHAR", "local_start_time": "VARCHAR",
        "duration_minutes": "INTEGER"}, "MASTER_DATA"),
    SourceContract("ref_source_id_crosswalk", "reference/source_id_crosswalk.csv", "csv", {
        "source_system": "VARCHAR", "source_id": "VARCHAR", "entity_type": "VARCHAR",
        "canonical_id": "VARCHAR"}, "MASTER_DATA"),
]


class ContractError(ValueError):
    """A landed file is missing or does not match its contract."""


def file_columns(path: Path, fmt: str) -> list[str]:
    if fmt == "csv":
        with path.open() as f:
            return f.readline().strip().split(",")
    if fmt == "jsonl":
        with path.open() as f:
            return list(json.loads(f.readline()).keys())
    return pq.read_schema(path).names


def validate(contract: SourceContract, landed_dir: Path = LANDED_DIR) -> Path:
    """Check the file exists, is non-empty and has exactly the contracted columns."""
    path = landed_dir / contract.path
    if not path.is_file():
        raise ContractError(f"{contract.name}: expected landed file {contract.path} is missing")
    if path.stat().st_size == 0:
        raise ContractError(f"{contract.name}: landed file {contract.path} is empty")
    found = file_columns(path, contract.fmt)
    expected = list(contract.columns)
    missing = sorted(set(expected) - set(found))
    extra = sorted(set(found) - set(expected))
    if missing or extra:
        raise ContractError(f"{contract.name}: schema drift in {contract.path} "
                            f"(missing={missing or '-'}, unexpected={extra or '-'})")
    return path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fixture_inventory(landed_dir: Path = LANDED_DIR) -> list[dict]:
    """Size/presence summary for the Pipeline tab's initial state."""
    rows = []
    for c in CONTRACTS:
        p = landed_dir / c.path
        rows.append({"source": c.source_system, "file": c.path, "format": c.fmt,
                     "size_kb": round(p.stat().st_size / 1024, 1) if p.exists() else None,
                     "present": p.exists()})
    return rows
