"""Filesystem locations, run lock and run-history state.

Code, fixtures and the dbt project are read-only inputs (they may live inside a
signed or read-only release bundle). Everything mutable — DuckDB files, dbt
target/logs, run history — lives under a per-user data directory.
"""

from __future__ import annotations

import json
import os
import shutil
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LANDED_DIR = REPO_ROOT / "data" / "landed"
DBT_PROJECT_DIR = REPO_ROOT / "dbt_project"


def data_home() -> Path:
    """Writable per-user directory; override with DEMO_HOME (used by tests)."""
    default = Path.home() / "Library" / "Application Support" / "ManufacturingDataDemo"
    path = Path(os.environ.get("DEMO_HOME", default)).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


@dataclass(frozen=True)
class Paths:
    home: Path

    @property
    def build_db(self) -> Path:
        """Database the pipeline writes to. Never read by the app.

        Build and serving files share one file name (in different folders) because
        DuckDB views bind to the catalog name, which is derived from the file name.
        """
        d = self.home / "build"
        d.mkdir(exist_ok=True)
        return d / "warehouse.duckdb"

    @property
    def serving_db(self) -> Path:
        """Last successfully built and tested database; the app reads only this."""
        return self.home / "warehouse.duckdb"

    @property
    def dbt_target(self) -> Path:
        return self.home / "dbt_target"

    @property
    def dbt_logs(self) -> Path:
        return self.home / "dbt_logs"

    @property
    def history(self) -> Path:
        return self.home / "run_history.json"

    @property
    def lock(self) -> Path:
        return self.home / "pipeline.lock"


def paths() -> Paths:
    return Paths(data_home())


class PipelineBusy(RuntimeError):
    """Raised when another pipeline run holds the lock."""


@contextmanager
def run_lock(p: Paths):
    """Exclusive, cross-process lock so two runs can never interleave."""
    try:
        fd = os.open(p.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        pid = p.lock.read_text().strip() if p.lock.exists() else "?"
        if pid.isdigit() and not _pid_alive(int(pid)):
            p.lock.unlink(missing_ok=True)  # stale lock from a crashed run
            fd = os.open(p.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        else:
            raise PipelineBusy("A pipeline run is already in progress.") from None
    try:
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        yield
    finally:
        p.lock.unlink(missing_ok=True)


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def is_running(p: Paths) -> bool:
    if not p.lock.exists():
        return False
    pid = p.lock.read_text().strip()
    return not (pid.isdigit() and not _pid_alive(int(pid)))


def load_history(p: Paths) -> list[dict]:
    try:
        return json.loads(p.history.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def append_history(p: Paths, record: dict, keep: int = 20) -> None:
    hist = (load_history(p) + [record])[-keep:]
    tmp = p.history.with_suffix(".tmp")
    tmp.write_text(json.dumps(hist, indent=2, default=str))
    os.replace(tmp, p.history)


def reset(p: Paths) -> None:
    """Delete all generated state (databases, dbt artifacts, history)."""
    if is_running(p):
        raise PipelineBusy("Cannot reset while a pipeline run is in progress.")
    for f in (p.build_db, p.serving_db, p.history):
        f.unlink(missing_ok=True)
        Path(str(f) + ".wal").unlink(missing_ok=True)
    shutil.rmtree(p.home / "build", ignore_errors=True)
    for d in (p.dbt_target, p.dbt_logs):
        shutil.rmtree(d, ignore_errors=True)
