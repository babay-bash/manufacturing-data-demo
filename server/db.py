"""Read-only access to the serving DuckDB database, plus SQL Explorer safeguards.

Defense in depth for reviewer-typed SQL:
  1. DuckDB's own parser must see exactly ONE statement, of type SELECT.
  2. sqlglot walks the AST and rejects file/OS-touching table functions and settings.
  3. The connection is opened read_only with external access disabled and the
     configuration locked, so even a parser gap cannot write or read local files.
  4. Results are capped (fetchmany) and long queries are interrupted by a timer.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import duckdb
import pandas as pd
import sqlglot
from sqlglot import exp

from pipeline.state import paths

MAX_ROWS = 5_000
TIMEOUT_SECONDS = 10

# Functions that can reach the filesystem, network or process environment.
BLOCKED_FUNCTIONS = {
    "read_csv", "read_csv_auto", "read_parquet", "parquet_scan", "read_json", "read_json_auto",
    "read_json_objects", "read_ndjson", "read_ndjson_auto", "read_ndjson_objects", "read_text",
    "read_blob", "read_xlsx", "glob", "sniff_csv", "parquet_metadata", "parquet_schema",
    "parquet_file_metadata", "parquet_kv_metadata", "getenv", "query", "query_table",
    "duckdb_secrets", "duckdb_settings", "current_setting", "delta_scan", "iceberg_scan",
    "sqlite_scan", "postgres_scan", "mysql_scan",
}


class UnsafeQuery(ValueError):
    """The submitted SQL is not a single read-only SELECT."""


def is_ready() -> bool:
    return paths().serving_db.exists()


def connect() -> duckdb.DuckDBPyConnection:
    """Fresh read-only connection per request (lets the pipeline atomically swap the file).

    Concurrent connections to the same file in this process share one DuckDB database instance,
    so the first connection sets UTC globally and locks the configuration;
    later overlapping connections find it already locked (and already UTC) and skip the SETs.
    """
    con = duckdb.connect(str(paths().serving_db), read_only=True, config={
        "enable_external_access": False, "threads": 2, "memory_limit": "1GB"})
    try:
        con.execute("SET GLOBAL TimeZone='UTC'")  # global, so later connections inherit it
        con.execute("SET lock_configuration=true")
    except duckdb.InvalidInputException as exc:
        if "locked" not in str(exc):
            con.close()
            raise
    return con


def query_df(sql: str, params: list | None = None) -> pd.DataFrame:
    """Trusted, app-authored queries (dashboard). Parameters are always bound, never formatted."""
    con = connect()
    try:
        return con.execute(sql, params or []).df()
    finally:
        con.close()


def validate_user_sql(sql: str) -> str:
    """Return the cleaned statement or raise UnsafeQuery with a reviewer-friendly message."""
    text = sql.strip().rstrip(";").strip()
    if not text:
        raise UnsafeQuery("Enter a SELECT query.")
    try:
        statements = duckdb.extract_statements(text)
    except duckdb.Error as exc:
        raise UnsafeQuery(f"SQL could not be parsed: {exc}") from None
    if len(statements) != 1:
        raise UnsafeQuery("Only a single statement is allowed (no `;`-separated batches).")
    if statements[0].type != duckdb.StatementType.SELECT:
        raise UnsafeQuery(f"Only read-only SELECT / WITH … SELECT queries are allowed "
                          f"(got {statements[0].type.name}).")
    try:
        tree = sqlglot.parse_one(text, read="duckdb")
    except sqlglot.errors.ParseError as exc:
        raise UnsafeQuery(f"SQL could not be parsed: {str(exc).splitlines()[0]}") from None
    if not isinstance(tree, exp.Query):
        raise UnsafeQuery("Only SELECT queries are allowed.")
    for node in tree.walk():
        if isinstance(node, (exp.DML, exp.DDL, exp.Command, exp.Set, exp.Pragma, exp.Copy)):
            raise UnsafeQuery(f"Statement type `{type(node).__name__}` is not allowed.")
        if isinstance(node, exp.Func):
            name = (node.name if isinstance(node, exp.Anonymous) else node.sql_name()).lower()
            if name in BLOCKED_FUNCTIONS:
                raise UnsafeQuery(f"Function `{name}` is disabled in the SQL Explorer.")
        if isinstance(node, exp.Table) and isinstance(node.this, exp.Literal):
            raise UnsafeQuery("Querying files by path is disabled; query the demo tables instead.")
    return text


@dataclass
class QueryResult:
    df: pd.DataFrame
    truncated: bool
    seconds: float


def run_user_query(sql: str, max_rows: int = MAX_ROWS, timeout: float = TIMEOUT_SECONDS) -> QueryResult:
    text = validate_user_sql(sql)
    con = connect()
    timer = threading.Timer(timeout, con.interrupt)
    t0 = time.perf_counter()
    try:
        timer.start()
        cur = con.execute(text)
        cols = [d[0] for d in cur.description]
        rows = cur.fetchmany(max_rows + 1)
    except duckdb.InterruptException:
        raise UnsafeQuery(f"Query exceeded the {timeout:.0f}s time limit and was cancelled.") from None
    finally:
        timer.cancel()
        con.close()
    truncated = len(rows) > max_rows
    return QueryResult(pd.DataFrame(rows[:max_rows], columns=cols), truncated, time.perf_counter() - t0)
