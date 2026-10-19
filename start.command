#!/bin/bash
# One-command launcher for the Manufacturing Data Platform demo (macOS).
#
#  * Release bundle  : uses the embedded Python runtime in ./runtime (fully offline, nothing installed).
#  * Git checkout    : uses uv to create .venv from uv.lock (needs network the first time only).
#
# Binds to 127.0.0.1 on a free port, opens the browser, Ctrl+C stops it.
# Never needs admin rights and never changes system settings.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
export DEMO_HOME="${DEMO_HOME:-$HOME/Library/Application Support/ManufacturingDataDemo}"
export PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
mkdir -p "$DEMO_HOME"

say() { printf '\033[1m[demo]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[demo] %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || say "Warning: built and tested for macOS; continuing anyway."

if [[ -x "$DIR/runtime/python/bin/python3" ]]; then
  # ---------- release bundle ----------
  BUNDLE_ARCH="$(cat "$DIR/runtime/ARCH" 2>/dev/null || echo unknown)"
  HOST_ARCH="$(uname -m)"
  if [[ "$BUNDLE_ARCH" != "$HOST_ARCH" ]]; then
    die "This release is built for $BUNDLE_ARCH but this Mac is $HOST_ARCH. Download the $HOST_ARCH release, or run from a git checkout with uv."
  fi
  # Unsigned downloads carry the quarantine flag, which makes Gatekeeper block the embedded
  # Python. Clear it on THIS folder only (your own files; no admin, no system settings).
  if xattr -pr com.apple.quarantine "$DIR" >/dev/null 2>&1; then
    say "Removing the download quarantine flag from this demo folder (unsigned release)…"
    xattr -dr com.apple.quarantine "$DIR" 2>/dev/null || true
  fi
  PY="$DIR/runtime/python/bin/python3"
else
  # ---------- developer checkout ----------
  if ! command -v uv >/dev/null 2>&1 && [[ -x "$HOME/.local/bin/uv" ]]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
  if ! command -v uv >/dev/null 2>&1; then
    say "uv (Python package manager) not found. Install it once with:"
    say "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    die "…or download the offline macOS release from the GitHub Releases page instead."
  fi
  say "Preparing Python environment with uv (first run downloads dependencies)…"
  uv sync --frozen --no-dev --quiet
  PY="$DIR/.venv/bin/python"
fi

PORT="$("$PY" -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
URL="http://127.0.0.1:$PORT"

"$PY" -m server --port "$PORT" &
APP_PID=$!
trap 'say "Stopping…"; kill $APP_PID 2>/dev/null; wait $APP_PID 2>/dev/null; exit 0' INT TERM

for _ in $(seq 1 120); do
  if curl -fs "$URL/api/status" >/dev/null 2>&1; then break; fi
  kill -0 $APP_PID 2>/dev/null || die "The app exited during startup — see messages above."
  sleep 0.5
done

say "Demo running at $URL   (data folder: $DEMO_HOME)"
say "Press Ctrl+C in this window to stop."
[[ "${DEMO_NO_BROWSER:-0}" == "1" ]] || open "$URL"
wait $APP_PID
