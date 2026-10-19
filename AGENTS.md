# AGENTS.md: guide for coding agents (Codex, Claude Code, …)

This file tells an automated coding agent how to work on this repository safely. Read
`README.md` for the product view. This file covers the engineering contract.

## What this repo is

A **local, offline demo** of a governed manufacturing data platform. Landed synthetic files
are loaded by Python into DuckDB `raw`. **Real dbt** (dbt-core 1.10 + dbt-duckdb) builds staging,
intermediate, quarantine, marts and reporting. A Streamlit app (4 tabs) reads the result. It is
interview material: clarity and correctness matter more than features.

## Setup and commands

```bash
uv sync                                   # Python 3.12 venv from uv.lock (never pip install ad hoc)
uv run pytest -q                          # all tests (~25 s); must pass before you finish
uv run python -m pipeline.run [--reset]   # CLI pipeline run (DEMO_HOME=/tmp/x to isolate)
DEMO_HOME=$PWD/.demo_home ./start.command # launch the app locally
packaging/build_macos.sh && packaging/verify_clean_mac.sh   # release + offline verification
```

Run dbt by hand (from the repo root):

```bash
DEMO_DB_PATH=/tmp/demo.duckdb uv run python -c "from dbt.cli.main import cli; cli()" build \
  --project-dir dbt_project --profiles-dir dbt_project
```

(Run ingestion first, e.g. `uv run python -c "from pipeline.ingest import ingest; from pathlib import Path; ingest(Path('/tmp/demo.duckdb'))"`.)

## Invariants: do not break these

1. **Exactly one fact (`fct_production_performance`) and six dimensions** in `marts`. Grain =
   `operation_id` (machine × work-order operation × date × shift). Pre-aggregate every source to
   operation grain *before* joining. Never let a join fan out. The tests
   `assert_fact_grain_matches_mes` and `test_fact_grain_has_no_row_multiplication` guard this.
2. **Store only additive measures in the fact.** KPIs are ratios of sums, defined **once** in
   `dbt_project/dbt_project.yml` → `vars.kpis`, rendered by the `kpi_select()` macro and read by
   `app/kpis.py`. To add or change a KPI, edit the YAML only, then keep
   `test_canonical_metrics_reconcile_dashboard_with_dbt` green. Never hard-code numbers in charts.
3. **Business transformations live in dbt SQL, not Python.** Python handles ingestion, orchestration
   and the UI only. Do not replace dbt with hand-run SQL.
4. **Nothing is silently dropped.** Bad, unmapped or orphan rows go to `quarantine.*` with a
   `quarantine_reason` and appear in `reporting.data_quality_summary`.
5. **Fixtures are deterministic and committed.** Change `scripts/generate_fixtures.py`, then run
   `make fixtures` and commit the regenerated `data/landed/**` *and* `_manifest.json`. Integration
   tests compare model outputs to the manifest's expected counts. No runtime downloads, ever.
6. **Promotion is blue/green.** `pipeline/run.py` builds into `<DEMO_HOME>/build/warehouse.duckdb`
   and copies it over `<DEMO_HOME>/warehouse.duckdb` only on full success. Both files must keep
   the **same file name**, because DuckDB views bind to the catalog name, which comes from the file
   name. Failures must never report success or promote partial output.
7. **SQL Explorer stays read-only.** Keep all layers in `app/db.py`: the DuckDB statement-type
   check, the sqlglot AST denylist, the `read_only` + `enable_external_access=false` connection,
   the row cap and the timeout. Add a case to `tests/unit/test_sql_guard.py` for any change.
8. **Offline and relocatable.** No network at runtime. Code must not write inside the repo or
   release folder; all mutable state goes under `DEMO_HOME`. Resolve paths from `__file__`, never
   from the cwd. Invoke dbt through `sys.executable -c "from dbt.cli.main import cli; cli()"`;
   console-script shims are not relocatable.
9. **Honest labeling.** Keep "synthetic", "local demo — not production" and the
   "variable cost proxy" wording. Do not claim streaming, Snowflake or AI features the demo lacks.

## Conventions

- dbt models are named `stg_<source>__<entity>`, `int_<source>__<purpose>`, `qtn_<source>_*`,
  `dim_*`, `fct_*`. Custom schemas use names as-is (`macros/generate_schema_name.sql`). Put generic
  test arguments under `arguments:` (dbt 1.10 style). Every new model gets a YAML entry with
  key tests.
- Python 3.12, type hints, short module docstrings explaining *why*, and no new heavy dependencies.
  Pin new dependencies in `pyproject.toml`, run `uv lock`, and note them in `THIRD_PARTY_LICENSES.md`.
- Streamlit 1.66 API: use `width="stretch"` (not `use_container_width`) and `st.iframe` (not
  `components.html`).
- Chart colors: facilities use fixed categorical slots `#2a78d6`, `#eb6834`, `#1baf7a` in
  `facility_id` order, and never re-color on filter. No dual-axis charts.

## Where things are

| Need | File |
|---|---|
| Source contracts (columns/types) | `pipeline/fixtures.py` |
| Ingestion / run orchestration / paths and lock | `pipeline/ingest.py`, `pipeline/run.py`, `pipeline/state.py` |
| dbt models and tests | `dbt_project/models/**`, `dbt_project/tests/**` |
| KPI definitions | `dbt_project/dbt_project.yml` (`vars.kpis`) |
| UI tabs | `app/tabs/{design,pipeline_panel,sql_explorer,dashboard}.py` |
| Production design text and diagrams | `docs/design.md`, `docs/architecture.mmd`, `docs/local-flow.mmd` |

## Review checklist for agents

- [ ] `uv run pytest -q` passes. A pipeline run shows `ERROR=0` in `dbt build`.
- [ ] Re-running the pipeline gives identical counts and KPIs (`test_rerun_is_idempotent_and_reset_works`).
- [ ] No new network calls, absolute paths or writes outside `DEMO_HOME`.
- [ ] Docs (`README.md`, `docs/*`) updated when behavior, counts or commands change.
- [ ] If packaging changed, `make release && make verify` passes, and its evidence file is updated.
