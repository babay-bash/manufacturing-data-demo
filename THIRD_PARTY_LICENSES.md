# Third-Party Licenses

| Component | Version | License | Use |
|---|---|---|---|
| dbt-core | 1.10.23 | Apache-2.0 | bundled runtime dependency |
| dbt-duckdb | 1.10.1 | Apache-2.0 | bundled runtime dependency |
| duckdb | 1.5.6 | MIT License | bundled runtime dependency |
| pandas | 3.0.6 | BSD 3-Clause License | bundled runtime dependency |
| pyarrow | 26.0.0 | Apache-2.0 | bundled runtime dependency |
| fastapi | 0.148.0 | MIT | bundled runtime dependency (API) |
| uvicorn | 0.54.0 | BSD-3-Clause | bundled runtime dependency (HTTP server) |
| React / react-dom | 18.3.1 | MIT | UI, compiled into web/dist |
| Recharts | 3.10.1 | MIT | dashboard charts, compiled into web/dist |
| lucide-react | 1.59.0 | ISC | generic icons, compiled into web/dist |
| simple-icons | 16.35.0 | CC0-1.0 (brand marks remain trademarks of their owners) | product logos in diagrams |
| sqlglot | 30.23.0 | MIT | bundled runtime dependency |
| CPython (python-build-standalone) | 3.12 | PSF-2.0 (+ bundled libs' licenses) | embedded interpreter in the macOS release |

Transitive dependencies are pinned in `uv.lock` / `packaging/requirements.lock`; their license files ship inside the release under `runtime/python/lib/python3.12/site-packages/*.dist-info/`.
