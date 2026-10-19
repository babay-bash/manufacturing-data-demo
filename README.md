# Trusted Data Foundation: local demo

A small, runnable slice of the architecture proposal in [`docs/design.md`](docs/design.md).
It runs entirely on a Mac, offline, with **synthetic data**.

> **Local demo, not production.** Kafka, object storage, Snowflake, CDC and the AI assistant
> appear in the architecture diagram but do **not** run here.

---

## The demo in two minutes

**The business question.** A manufacturer with three plants asks: *How much does it cost to make
a **good** unit, and is extra cost caused by materials, energy, quality problems or downtime?*
Answering it means combining four systems that disagree: **MES** (production), **QMS** (defects),
**ERP** (material costs, energy prices) and **machine telemetry** (energy use, running or stopped).

**What the demo shows.** It takes messy source files and turns them into **one trusted table**
with **one set of KPI definitions**. The dashboard, the SQL you type and the dbt-built reports
all give the same answer, and the tests prove it. This is the "governed KPI" and "quality and
correctness" deep dive from the proposal, at laptop scale.

**Try it in three steps** (after starting it, see *Run it* below):

| Step | Where | What you'll see |
|---|---|---|
| 1. Build the data | **Pipeline** tab → **Run pipeline** | Real Python loads the files, then the real `dbt build` runs 32 models and 96 tests (~5 s). Live log, row counts, and what was quarantined and why. |
| 2. Read the results | **Dashboard** tab | Cost per good unit, OEE, scrap, energy. Filter by plant, line, product or shift. |
| 3. Check the numbers | **SQL** tab | Run the example queries, or your own read-only SQL, against the same tables. |

**Things to look for** (all synthetic, planted on purpose):

- **Monterrey line MX-L2** is the problem line: OEE ≈ 65% vs ≈ 84% elsewhere, from extra downtime
  and slower cycles.
- **Dayton machine M-OH-L1-01** uses ~1.6× the energy of comparable machines.
- **Stuttgart, 15 kW drive, July:** a scrap spike (quality excursion).
- **Dirty data handled visibly:** 1,200 duplicate sensor messages removed, 600 bad readings and
  an unknown sensor quarantined (with reasons), late data included, a kWh→Wh unit switch
  corrected, duplicate ERP postings resolved. See *Pipeline → Data quality*.
- **One definition, one answer:** *Dashboard → Reconciliation with dbt* shows every KPI matching.

**What's real and what's a stand-in:**

| Real in this demo | Stand-in for production |
|---|---|
| Python ingestion with source contracts | Committed files in `data/landed/` stand in for Kafka + object storage + CDC/exports |
| dbt models and 96 tests (dbt-core 1.10 + dbt-duckdb) | DuckDB stands in for Snowflake / Databricks |
| One fact table + six dimensions, explicit grain | KPI definitions in `dbt_project.yml` stand in for a semantic layer |
| Read-only SQL with guard rails | No AI assistant (the proposal adds it with regression tests) |
| Failed runs never replace good data | No auth or row-level security |

---

## Run it

### Option A: offline release (no installs)

Requires nothing preinstalled: no Python, Node, Homebrew, Docker, dbt or network.

1. **Download the release file** (Apple Silicon Macs, ~145 MB):
   **[manufacturing-data-demo-macos-arm64.tar.gz](https://github.com/babay-bash/manufacturing-data-demo/releases/download/v0.1.0/manufacturing-data-demo-macos-arm64.tar.gz)**

   It is a GitHub **Release asset**, not a file in the repository tree. You can also find it on the
   [v0.1.0 release page](https://github.com/babay-bash/manufacturing-data-demo/releases/tag/v0.1.0)
   under **Assets**, next to its `.sha256` checksum. Or download it from Terminal:

   ```bash
   cd ~/Downloads
   curl -LO https://github.com/babay-bash/manufacturing-data-demo/releases/download/v0.1.0/manufacturing-data-demo-macos-arm64.tar.gz
   ```
2. In Terminal:

   ```bash
   cd ~/Downloads
   tar -xzf manufacturing-data-demo-macos-arm64.tar.gz
   cd manufacturing-data-demo-macos-arm64
   ./start.command
   ```

3. Your browser opens at `http://127.0.0.1:<port>`. To stop, press `Ctrl+C` in Terminal.

*Why Terminal?* The release isn't signed by Apple (no Developer ID). From Terminal it just works:
the launcher clears the "downloaded from the internet" flag on **its own folder only**, with no
admin rights and no system changes. Double-clicking in Finder may be blocked; if so, right-click →
**Open**.

### Option B: from source (developers)

Needs [uv](https://docs.astral.sh/uv/). It downloads Python and dependencies once. Node is **not**
needed, because the built UI is committed.

```bash
git clone https://github.com/babay-bash/manufacturing-data-demo.git
cd manufacturing-data-demo
./start.command
```

| Command | What it does |
|---|---|
| `make test` | All tests: `uv run pytest -q` (48 tests, ~25 s; runs the real dbt build) |
| `make pipeline` | Run ingestion + `dbt build` from the command line |
| `make ui` | Rebuild the React UI into `web/dist` (needs Node 20+) |
| `make release` | Build the offline release for this Mac into `dist/` |
| `make verify` | Unpack the release into an empty folder and run it offline in a sandbox |

Built data lives in `~/Library/Application Support/ManufacturingDataDemo/`. Set `DEMO_HOME` to
change it. **Reset** on the Pipeline tab deletes it.

---

## How the code works

```
data/landed/*.csv|jsonl|parquet        synthetic source files (committed, deterministic)
        │  pipeline/ingest.py          check each file's contract, load into DuckDB raw.* with lineage columns
        ▼
DuckDB  raw ──dbt──► staging ──► intermediate ──► marts (1 fact + 6 dims) ──► reporting views
                                     └──► quarantine (rows excluded, with reasons)
        │  pipeline/run.py             build in a separate file; promote only if every test passes
        ▼
server/api.py (FastAPI)  ──JSON──►  web/ (React + TypeScript): Start here · Architecture · Pipeline · SQL · Dashboard
```

| Folder | What's inside |
|---|---|
| `pipeline/` | `fixtures.py` source contracts · `ingest.py` loads raw tables · `run.py` runs ingestion → dbt → promotion · `state.py` paths, run lock, history |
| `dbt_project/` | dbt models (`staging/`, `intermediate/`, `quarantine/`, `marts/`, `reporting/`), tests, and **KPI definitions** in `dbt_project.yml` |
| `server/` | `api.py` HTTP API + serves the UI · `db.py` read-only DuckDB access and the SQL guard · `kpis.py` builds dashboard queries from the shared KPI definitions |
| `web/` | React + TypeScript UI (`src/`), prebuilt into `dist/` |
| `data/landed/` | Synthetic source files + `_manifest.json` (expected anomaly counts, used by tests) |
| `scripts/` | `generate_fixtures.py`: seeded generator for the source files |
| `docs/` | `design.md` (the proposal), `data_dictionary.md`, `kpi_definitions.md`, `decisions_and_tradeoffs.md`, `ai_assistance.md` |
| `tests/` | `unit/`, `integration/` (runs the real pipeline), `smoke/` (API) |
| `packaging/` | Offline release build and verification scripts, plus evidence |

**Key design points:**

- **One fact table.** `marts.fct_production_performance` has one row per machine × work order ×
  date × shift. Every source is summarized to that grain **before** joining, so nothing gets
  double-counted, and a test checks that row count equals MES operations.
- **KPIs are defined once.** Formulas live in `dbt_project/dbt_project.yml` (`vars.kpis`). dbt
  uses them to build `reporting.kpi_*`, and the API uses the same text for the dashboard. Every
  KPI is a ratio of sums (never an average of percentages) and safe when dividing by zero. See
  [`docs/kpi_definitions.md`](docs/kpi_definitions.md).
- **Nothing silently dropped.** Bad, unknown or orphan records go to `quarantine.*` with a reason.
- **Safe re-runs and failures.** Each run rebuilds from scratch (re-running gives identical
  results). The app only switches to a new build after all 96 dbt tests pass.
- **Read-only SQL.** One `SELECT` per query, checked by DuckDB's parser **and** an AST check
  (no writes, no file or environment access). The connection itself is read-only with file access
  off, results are capped at 5,000 rows, and queries stop after 10 s.

*Variable cost per good unit* is a **proxy**: material plus energy only, with no labor or overhead.

## Tests

`uv run pytest -q` runs 48 tests:

- **Unit:** source contracts and schema drift; KPI formulas are ratios of sums and divide-by-zero
  safe; filter values are passed as parameters; 21 allowed/blocked SQL cases.
- **Integration** (real pipeline): exactly 1 fact + 6 dimensions; no double counting; duplicate,
  late, quarantine and ERP counts match the generator's manifest; a tariff change in the middle of
  a night shift; Wh→kWh normalization; dashboard = dbt for every KPI; SQL timeout and row cap;
  read-only connection; identical results on re-run; reset; a bad file or a failing dbt test
  never replaces good data.
- **Smoke:** API status, dashboard, SQL allow/block, lineage, launcher syntax.

## Platform support

| | Status |
|---|---|
| macOS 15, Apple Silicon | Release built and checked by `packaging/verify_clean_mac.sh`: fresh unpack with the download flag set, empty home folder, no Homebrew/uv/dbt on PATH, network blocked. Evidence: `packaging/verification-arm64.txt` |
| Intel Macs | Not built. Run `make release` on an Intel Mac, or use Option B |
| Fresh VM test | Not done yet. The check above simulates a clean machine on the build Mac |
| Code signing | Not done (no Apple Developer ID) |

## Known limitations

Batch only (nothing streams). One work order per machine per shift. Natural keys instead of
surrogate keys. No auth, document search or AI assistant. Variable cost is a proxy. All names,
rates and volumes are invented.

## AI assistance

- **Architecture write-up:** AI helped organize, edit and challenge trade-offs. Priorities and final
  choices are the author's.
- **Demo:** generated with AI (**Claude Code**) from the author's specification and reviewed by the
  author. This covers the application code, the synthetic data and source samples (MES, QMS, ERP,
  telemetry), and the manufacturing KPI definitions.

Details, including where the author overrode AI suggestions, are in
[`docs/ai_assistance.md`](docs/ai_assistance.md).
