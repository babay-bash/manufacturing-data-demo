# Plant & Field Data Platform — local demo

A small, runnable illustration of a governed manufacturing data platform: **real Python
ingestion** and **real dbt transformations and tests** on a local **DuckDB** file, served through a
four-tab web app (Design · Pipeline · SQL Explorer · KPI Dashboard).

> **This is a local demo, not a production system.** All data are **synthetic**. The production
> design (Kafka, S3, Snowflake, dbt, semantic layer, governed AI) is described in the app's
> Design tab and in [`docs/design.md`](docs/design.md); none of those services run here.

The demo answers one business question end to end:

> *How much does it cost to make a **good** unit, which sites, lines, machines and products
> underperform, and is the excess driven by materials, energy, quality or downtime?*

It joins four synthetic source systems (**MES** production, **QMS** defects, **ERP** material
costs and energy tariffs, **machine telemetry**) into **one fact table with six conformed
dimensions**, and computes every KPI from a single set of shared definitions.

---

## Run it on a Mac

### Option A: offline release (recommended for reviewers)

Requires nothing preinstalled: no Python, Homebrew, Docker, dbt or network.

1. Download `manufacturing-data-demo-macos-arm64.tar.gz` from the
   [GitHub Releases page](../../releases) (Apple Silicon; see *Platform support* for Intel).
2. In Terminal:

   ```bash
   cd ~/Downloads
   tar -xzf manufacturing-data-demo-macos-arm64.tar.gz
   cd manufacturing-data-demo-macos-arm64
   ./start.command
   ```

3. The browser opens at `http://127.0.0.1:<port>`. Open the **② Pipeline** tab and click
   **Run pipeline** (about 5–10 s). Then explore **③ SQL Explorer** and **④ KPI Dashboard**.
   Press `Ctrl+C` in Terminal to stop.

**Gatekeeper:** the release is **unsigned and not notarized** (no Apple Developer ID is
available). Running `./start.command` from Terminal works: the launcher removes the
download-quarantine flag from **its own folder only**, with no admin rights and no system settings
changed. Double-clicking `start.command` in Finder will likely be blocked. If so, right-click it
and choose **Open**, or use Terminal.

### Option B: from a git checkout (developers)

Requires [uv](https://docs.astral.sh/uv/). It needs network once, to fetch Python 3.12 and the
locked dependencies.

```bash
git clone https://github.com/babay-bash/manufacturing-data-demo.git
cd manufacturing-data-demo
./start.command            # uv sync --frozen, then launches the app
```

Other developer commands (see the [`Makefile`](Makefile)):

| Command | What it does |
|---|---|
| `make test` | Unit, integration (runs the real dbt build) and smoke tests: `uv run pytest -q` |
| `make pipeline` | Run ingestion + `dbt build` from the CLI and print the run record |
| `make fixtures` | Regenerate the deterministic synthetic fixtures (byte-identical for the same seed) |
| `make release` | Build the offline release for this Mac's CPU into `dist/` |
| `make verify` | Extract the release into an empty folder and run it offline in a sandbox with a minimal PATH |

Built data lives in `~/Library/Application Support/ManufacturingDataDemo/`. Override it with
`DEMO_HOME=/some/path`. **Reset** in the Pipeline tab deletes it.

---

## What happens when you click *Run pipeline*

```
data/landed/*  ──►  pipeline/ingest.py  ──►  DuckDB raw.*  ──►  dbt build  ──►  promote
 (committed           validate contracts,      snapshot-        staging →        copy build DB
  synthetic files)    load with lineage cols   replace          intermediate →   over serving DB
                                                                quarantine →     only if every
                                                                marts →          model AND test
                                                                reporting        passed
```

1. **Ingestion** (`pipeline/ingest.py`) checks every landed file against its contract
   (`pipeline/fixtures.py`: presence, non-empty, exact columns). It then loads each file
   into `raw.*` with lineage columns (`_source_file`, `_source_row`, `_batch_id`, `_loaded_at`),
   in one transaction. Each file is a full snapshot, so a re-run *replaces* rather than appends,
   and raw data never grows.
2. **`dbt build`** is the real dbt CLI (dbt-core 1.10 + dbt-duckdb), not simulated SQL. It
   runs 32 models and 96 tests: staging (typing, unit normalization), intermediate (dedup,
   crosswalks, time alignment, tariff joins), quarantine, marts and reporting.
3. **Blue/green promotion** (`pipeline/run.py`): dbt writes to a separate build database. That
   database replaces the one the app reads only after every model and error-severity test passes.
   A failed run is reported as failed, and the app keeps serving the previous good build, labeled
   with its build time. Nothing half-built is ever shown.
4. A file lock prevents concurrent runs, including from multiple browser tabs.

## Data model

**Fact:** `marts.fct_production_performance`. **Grain:** one row per facility × line × machine ×
work-order operation × date × shift (`operation_id`). MES is the spine. Every other source is
aggregated to operation grain **before** the join, so joins are 1:1 and cannot multiply cost or
energy. A test asserts fact rows = MES operations.

**Dimensions:** `dim_date`, `dim_facility`, `dim_line`, `dim_machine`, `dim_product`,
`dim_shift`. `work_order_id` is a degenerate dimension.

**Stored measures are additive only:** units produced, rejected units (distinct serials),
good units, planned / operating / idle / downtime minutes, ideal run seconds, energy kWh,
energy cost, material cost and variable cost. Ratios are never stored.

**KPIs** (`dbt_project/dbt_project.yml` → `vars.kpis`) are ratios of sums with `NULLIF`-guarded
denominators: variable cost per good unit, material cost per good unit, OEE (availability ×
performance × quality), scrap rate, yield, energy per good unit and downtime. The **same YAML**
feeds the dbt macro that builds `reporting.kpi_*` and the dashboard queries. A test proves
they agree. See [`docs/kpi_definitions.md`](docs/kpi_definitions.md).

> *Variable cost per good unit* is a **proxy**: ERP material plus telemetry energy priced at the
> ERP tariff valid on the interval's **local** date. It excludes labor, overhead and depreciation.

### Injected anomalies (deterministic, and checked by tests against `data/landed/_manifest.json`)

| Anomaly | Handling |
|---|---|
| 1,200 duplicate telemetry deliveries | Deduplicated on stable `event_id`, keeping the latest ingestion |
| Late / out-of-order telemetry (gateway buffer flushed 1–3 days later) | Included, because batch recomputation absorbs it. Flagged `is_late_arrival` |
| 600 bad-quality energy readings | Quarantined (not imputed). Counted per operation in the fact |
| Unmapped historian tag (new machine not in master data) | Quarantined as `UNMAPPED_SOURCE_TAG` |
| Stuttgart gateways switch kWh → Wh on 2026-07-15 | Normalized in staging. Tested |
| Legacy Monterrey MES machine codes | Resolved through `source_id_crosswalk` |
| ERP re-export duplicates and later corrections | Latest version per `transaction_id`. Reconciled to the cent |
| QMS events for unknown operations | Quarantined |
| Multiple defects on one unit | Rejected units = `COUNT(DISTINCT unit_serial)` |
| Tariff change in the middle of a night shift | Priced per 15-minute interval by local date. Tested |
| Zero-good-unit shifts (outages, quality holds) | Kept. Ratios return NULL, never divide by zero |

The SQL tab's `06 data quality` example and the Pipeline tab show these counts live.

## SQL Explorer safety

Reviewer SQL runs only if **all** of these checks pass:

1. DuckDB's own parser sees exactly **one** statement of type `SELECT`.
2. A sqlglot AST walk rejects DDL, DML, `COPY`, `ATTACH`, `PRAGMA`, `SET` and file- or
   environment-reading functions (`read_csv`, `glob`, `getenv`, …).
3. The connection is `read_only` with `enable_external_access=false` and locked configuration,
   so even a parser gap cannot write or read local files.
4. Results stop at 5,000 rows and a 10-second timer interrupts long queries.

## Tests

`uv run pytest -q` runs 47 tests in about 25 s:

- **unit:** source contracts and schema drift; KPI definitions are ratios of sums and
  null-safe; filter values are bound as parameters; 21 SQL-guard allow/deny cases.
- **integration** (runs the real pipeline): exactly 1 fact + 6 dims; no row multiplication;
  dedup, late-data, quarantine and ERP counts equal the generator manifest; tariff boundary on a
  night shift; Wh normalization; the dashboard reconciles with dbt `reporting.kpi_overall`;
  query timeout and row cap; read-only connection; **re-runs are idempotent**; reset works; a
  contract failure promotes nothing; a dbt test failure keeps the previous good build.
- **smoke:** the Streamlit app renders all four tabs with six KPI cards, the SQL tab blocks
  `DROP`, and the launcher is valid bash.

The 96 dbt tests (generic and singular, in `dbt_project/`) run on every pipeline click.

## Repository layout

```
start.command            one-command launcher (bundled runtime if present, else uv)
app/                     Streamlit UI: main.py, tabs/, db.py (read-only + SQL guard), kpis.py
pipeline/                fixtures.py (contracts), ingest.py, run.py (orchestration/promotion), state.py
dbt_project/             dbt project: models/{staging,intermediate,quarantine,marts,reporting}, tests/, macros/
data/landed/             committed synthetic fixtures + _manifest.json (expected anomaly counts)
scripts/                 generate_fixtures.py (deterministic, seeded)
sql/examples/            example queries loaded by the SQL tab
docs/                    design.md, architecture.mmd, local-flow.mmd, data_dictionary.md,
                         kpi_definitions.md, decisions_and_tradeoffs.md, ai_assistance.md
packaging/               build_macos.sh, verify_clean_mac.sh, requirements.lock, verification evidence
tests/                   unit/, integration/, smoke/
AGENTS.md                guide for coding agents (Codex, Claude Code) working on this repo
```

## Platform support and release verification

| Target | Status |
|---|---|
| macOS 15 · Apple Silicon (arm64) | Release built and verified with `packaging/verify_clean_mac.sh`: fresh extraction, quarantine flag set, empty HOME, PATH without Homebrew/uv/dbt, outbound network denied. Evidence is in `packaging/verification-arm64.txt` |
| macOS · Intel (x86_64) | **Not built or tested.** Run `make release` on an Intel Mac to produce it, or use Option B |
| Pristine VM / second machine | **Not yet done.** The verification above simulates a clean environment on the build host; it does not replace a test on a fresh VM |
| Code signing / notarization | **Not done** (no Developer ID). See *Gatekeeper* above |

## Known limitations (intentional scope)

- Batch only. Telemetry has real timestamps, but nothing streams, and no Kafka, S3 or Snowflake runs.
- One work order per machine per shift. Production would need operation-split or allocation rules.
- Natural keys, not surrogate/SCD2 keys, because master data is static in the fixtures.
- No authentication, row-level security, document RAG or AI chat. Those are described in the design only.
- The variable-cost KPI is a proxy (see above). Synthetic volumes are design targets, not client facts.

## AI assistance

The architecture was dictated by the author and structured with AI assistance. This repository
was implemented with **Claude Code** from the author's written demo specification, then
reviewed by the author. Details, including where the author overrode AI suggestions, are in
[`docs/ai_assistance.md`](docs/ai_assistance.md).
