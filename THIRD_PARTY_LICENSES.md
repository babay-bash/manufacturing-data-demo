# Third-Party Licenses

| Component | Version | License | Use |
|---|---|---|---|
| Mermaid | 11.4.1 | MIT | Vendored at `app/static/mermaid.min.js`; renders architecture diagrams offline in the Design tab |
| dbt-core | 1.10.23 | Apache-2.0 | bundled runtime dependency |
| dbt-duckdb | 1.10.1 | Apache-2.0 | bundled runtime dependency |
| duckdb | 1.5.6 | MIT License | bundled runtime dependency |
| streamlit | 1.66.0 | Apache-2.0 | bundled runtime dependency |
| pandas | 3.0.6 | BSD 3-Clause License | bundled runtime dependency |
| pyarrow | 26.0.0 | Apache-2.0 | bundled runtime dependency |
| altair | 6.3.0 | BSD-3-Clause | bundled runtime dependency |
| sqlglot | 30.23.0 | MIT | bundled runtime dependency |
| CPython (python-build-standalone) | 3.12 | PSF-2.0 (+ bundled libs' licenses) | embedded interpreter in the macOS release |

Transitive dependencies are pinned in `uv.lock` / `packaging/requirements.lock`; their license files ship inside the release under `runtime/python/lib/python3.12/site-packages/*.dist-info/`.
