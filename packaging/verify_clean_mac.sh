#!/bin/bash
# Approximate a clean reviewer Mac for the release archive, and record evidence:
#   * fresh extraction into an empty temp dir, with the download-quarantine flag applied
#   * empty HOME, PATH limited to /usr/bin:/bin:/usr/sbin:/sbin (no Homebrew, uv, pyenv, dbt)
#   * outbound network denied by a sandbox profile (only 127.0.0.1 allowed)
#   * launches ./start.command, waits for the app, runs the real pipeline with the bundled
#     interpreter, and fetches the page over localhost.
# This is NOT a pristine VM: system libraries and Rosetta state are the host's. Record
# results from real clean machines/VMs separately (see README "Release verification").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH="$(uname -m)"
ARCHIVE="${1:-$ROOT/dist/manufacturing-data-demo-macos-$ARCH.tar.gz}"
WORK="$(mktemp -d /tmp/demo-verify.XXXXXX)"
EVIDENCE="$ROOT/packaging/verification-$ARCH.txt"
PROFILE='(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(allow network-outbound (remote unix-socket))'

log() { echo "$*" | tee -a "$EVIDENCE"; }
: > "$EVIDENCE"
log "verify_clean_mac  $(date -u +%Y-%m-%dT%H:%M:%SZ)  host macOS $(sw_vers -productVersion) $ARCH"
log "archive: $(basename "$ARCHIVE")  sha256 $(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)"

mkdir -p "$WORK/home"
tar -xzf "$ARCHIVE" -C "$WORK"
APP="$WORK/$(basename "$ARCHIVE" .tar.gz)"
xattr -w -r com.apple.quarantine "0081;$(printf %x "$(date +%s)");Safari;" "$APP" 2>/dev/null || \
  find "$APP" -exec xattr -w com.apple.quarantine "0081;00000000;Safari;" {} \; 2>/dev/null
log "extracted to $APP (quarantine flag applied to simulate a browser download)"

CLEAN_ENV=(env -i HOME="$WORK/home" PATH=/usr/bin:/bin:/usr/sbin:/sbin TMPDIR="$WORK" LANG=en_US.UTF-8
           DEMO_NO_BROWSER=1 DEMO_HOME="$WORK/home/demo-data")
log "tools visible on PATH: uv=$(PATH=/usr/bin:/bin command -v uv || echo none) dbt=$(PATH=/usr/bin:/bin command -v dbt || echo none) brew=$(PATH=/usr/bin:/bin command -v brew || echo none)"

sandbox-exec -p "$PROFILE" "${CLEAN_ENV[@]}" "$APP/start.command" > "$WORK/launcher.log" 2>&1 &
LPID=$!
URL=""
for _ in $(seq 1 120); do
  URL="$(grep -o 'http://127.0.0.1:[0-9]*' "$WORK/launcher.log" | tail -1 || true)"
  [[ -n "$URL" ]] && grep -q "Demo running" "$WORK/launcher.log" && break
  kill -0 $LPID 2>/dev/null || { cat "$WORK/launcher.log"; log "FAIL: launcher exited"; exit 1; }
  sleep 0.5
done
[[ -n "$URL" ]] || { cat "$WORK/launcher.log"; log "FAIL: app did not start"; exit 1; }
log "launcher started app at $URL (network-denied sandbox)"
log "quarantine flag cleared by launcher: $([[ -z "$(xattr -p com.apple.quarantine "$APP/runtime/python/bin/python3" 2>/dev/null)" ]] && echo yes || echo NO)"
curl -fs "$URL/_stcore/health" >/dev/null && log "health endpoint: ok"
curl -fs "$URL/" | grep -qi "<title>" && log "page served over localhost: ok"

log "running pipeline with the bundled interpreter (sandboxed, offline)…"
if sandbox-exec -p "$PROFILE" "${CLEAN_ENV[@]}" bash -c "cd '$APP' && runtime/python/bin/python3 -m pipeline.run" \
     > "$WORK/pipeline.log" 2>&1; then
  log "pipeline: $(grep -E 'Done\. PASS' "$WORK/pipeline.log" | sed 's/^[0-9:]* *//')"
  log "pipeline status: success"
else
  tail -30 "$WORK/pipeline.log"; log "FAIL: pipeline run failed"; kill $LPID; exit 1
fi

kill -TERM $LPID 2>/dev/null; wait $LPID 2>/dev/null || true
log "launcher stopped cleanly"
log "RESULT: PASS (simulated clean environment on build host; not a substitute for a pristine VM)"
rm -rf "$WORK"
