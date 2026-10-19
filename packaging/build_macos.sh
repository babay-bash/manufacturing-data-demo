#!/bin/bash
# Build the self-contained, offline macOS reviewer release for THIS machine's CPU architecture.
#
#   packaging/build_macos.sh        ->  dist/manufacturing-data-demo-macos-<arch>.tar.gz
#
# Bundles: relocatable CPython 3.12 (python-build-standalone, via uv) + every locked dependency
# (dbt-core, dbt-duckdb, duckdb, streamlit, ...) installed into it with hash checking, plus the app,
# pipeline, dbt project, fixtures and docs. Needs network on the BUILD machine only.
# Run it on an Intel Mac (or under Rosetta with an x86_64 uv) to produce the x86_64 bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ARCH="$(uname -m)"
NAME="manufacturing-data-demo-macos-$ARCH"
OUT="$ROOT/dist/$NAME"

echo "==> Cleaning dist/$NAME"
rm -rf "$OUT" "$OUT.tar.gz" "$OUT.tar.gz.sha256"
mkdir -p "$OUT/runtime"

echo "==> Locking dependencies (packaging/requirements.lock, with hashes)"
uv lock --check >/dev/null
uv export --frozen --no-dev --no-emit-project --format requirements-txt -o packaging/requirements.lock >/dev/null

echo "==> Copying relocatable CPython 3.12 (python-build-standalone)"
uv python install 3.12 >/dev/null
PYBIN="$(uv python find --managed-python 3.12)"
PYROOT="$(cd "$(dirname "$PYBIN")/.." && pwd)"
cp -R "$PYROOT" "$OUT/runtime/python"
PY="$OUT/runtime/python/bin/python3"
STDLIB="$("$PY" -c 'import sysconfig; print(sysconfig.get_paths()["stdlib"])')"
rm -f "$STDLIB/EXTERNALLY-MANAGED"
rm -rf "$STDLIB/test" "$STDLIB/idlelib" "$STDLIB/tkinter" "$STDLIB/turtledemo"   # unused, ~30MB
echo "$ARCH" > "$OUT/runtime/ARCH"

echo "==> Installing locked dependencies into the bundled interpreter"
uv pip install --python "$PY" --require-hashes --no-deps --compile-bytecode --quiet \
  -r packaging/requirements.lock

echo "==> Copying application sources, dbt project and fixtures"
rsync -a --exclude '__pycache__' --exclude 'target/' --exclude 'logs/' --exclude '.DS_Store' \
  app pipeline dbt_project data docs sql "$OUT/"
cp start.command README.md AGENTS.md THIRD_PARTY_LICENSES.md pyproject.toml uv.lock "$OUT/"
chmod +x "$OUT/start.command"
"$PY" -m compileall -q "$OUT/app" "$OUT/pipeline"

echo "==> Recording version provenance"
{
  echo "built_at_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "git_commit: $(git rev-parse --short HEAD 2>/dev/null || echo uncommitted)"
  echo "arch: $ARCH"
  echo "macos_build_host: $(sw_vers -productVersion)"
  echo "python: $("$PY" --version)"
  echo "dbt: $("$PY" -c 'from importlib.metadata import version as v; print("dbt-core", v("dbt-core"), "/ dbt-duckdb", v("dbt-duckdb"), "/ duckdb", v("duckdb"), "/ streamlit", v("streamlit"))')"
  echo "signed: no (unsigned, not notarized — see README 'Gatekeeper')"
} > "$OUT/BUILD_INFO.txt"

echo "==> Smoke check: bundled dbt is a real, executable dbt engine"
DBT_VERSION_OUT="$(DBT_VERSION_CHECK=false "$PY" -c "from dbt.cli.main import cli; cli()" --version 2>&1)"
echo "$DBT_VERSION_OUT" | grep -E "installed|duckdb" || { echo "$DBT_VERSION_OUT"; exit 1; }

echo "==> Archiving"
(cd "$ROOT/dist" && tar -czf "$NAME.tar.gz" "$NAME" && shasum -a 256 "$NAME.tar.gz" > "$NAME.tar.gz.sha256")
du -sh "$OUT" "$OUT.tar.gz"
echo "==> Done: dist/$NAME.tar.gz   (verify with packaging/verify_clean_mac.sh)"
