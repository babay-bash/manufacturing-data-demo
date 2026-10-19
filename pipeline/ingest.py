"""Load landed fixture files into DuckDB `raw` tables.

Load strategy: each landed file is a complete snapshot of its source, so every
run atomically replaces the raw table inside one transaction (snapshot
replace). Re-running therefore never grows raw data, and a failure mid-load
rolls back to the previous raw state. Production would instead append
immutable batches to S3/Snowflake and deduplicate on stable keys downstream —
the dbt staging/intermediate models already deduplicate on those keys, so the
transformation logic is the same either way.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from pipeline.fixtures import CONTRACTS, SourceContract, sha256, validate
from pipeline.state import LANDED_DIR


def _reader_sql(c: SourceContract, path: Path) -> str:
    cols = ", ".join(f"'{k}': '{v}'" for k, v in c.columns.items())
    p = str(path).replace("'", "''")
    if c.fmt == "csv":
        return f"read_csv('{p}', header=true, columns={{{cols}}}, auto_detect=false)"
    if c.fmt == "jsonl":
        return f"read_json('{p}', format='newline_delimited', columns={{{cols}}})"
    return f"read_parquet('{p}')"


def ingest(db_path: Path, landed_dir: Path = LANDED_DIR, log=print) -> dict:
    """Validate all contracts, then snapshot-load every source. Returns a run record."""
    batch_id = uuid.uuid4().hex[:12]
    started = datetime.now(timezone.utc)
    files = [(c, validate(c, landed_dir)) for c in CONTRACTS]  # validate everything first
    log(f"Validated {len(files)} landed files against their source contracts")

    con = duckdb.connect(str(db_path))
    counts: dict[str, int] = {}
    try:
        con.execute("SET TimeZone='UTC'")
        con.execute("CREATE SCHEMA IF NOT EXISTS raw")
        con.execute("CREATE SCHEMA IF NOT EXISTS meta")
        con.execute("BEGIN TRANSACTION")
        for c, path in files:
            t0 = time.perf_counter()
            casts = ", ".join(f"CAST({k} AS {v}) AS {k}" for k, v in c.columns.items())
            con.execute(f"""
                CREATE OR REPLACE TABLE raw.{c.name} AS
                SELECT {casts},
                       '{c.source_system}'                   AS _source_system,
                       '{c.path}'                            AS _source_file,
                       row_number() OVER ()                  AS _source_row,
                       '{batch_id}'                          AS _batch_id,
                       TIMESTAMPTZ '{started.isoformat()}'   AS _loaded_at
                FROM {_reader_sql(c, path)}
            """)
            n = con.execute(f"SELECT count(*) FROM raw.{c.name}").fetchone()[0]
            counts[c.name] = n
            log(f"  raw.{c.name:<28} {n:>9,} rows  ({time.perf_counter() - t0:.2f}s)")
        con.execute("""
            CREATE TABLE IF NOT EXISTS meta.ingestion_runs (
                batch_id VARCHAR, raw_table VARCHAR, source_file VARCHAR,
                file_sha256 VARCHAR, row_count BIGINT, loaded_at TIMESTAMPTZ)""")
        for c, path in files:
            con.execute("INSERT INTO meta.ingestion_runs VALUES (?, ?, ?, ?, ?, ?)",
                        [batch_id, c.name, c.path, sha256(path), counts[c.name], started])
        con.execute("COMMIT")
    except Exception:
        try:
            con.execute("ROLLBACK")
        except duckdb.Error:
            pass  # failure happened before the transaction opened
        raise
    finally:
        con.close()
    return {"batch_id": batch_id, "raw_row_counts": counts}
