#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8126}"
DURATION_SECONDS="${DURATION_SECONDS:-7200}"
LOG_FILE="${LOG_FILE:-/tmp/needle-peak-soak.log}"
SUMMARY_FILE="${SUMMARY_FILE:-/tmp/needle-peak-soak-summary.jsonl}"
HEADLESS_FLAG="${HEADLESS_FLAG:---headed=0}"
SLOW_MO="${SLOW_MO:-0}"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$SUMMARY_FILE")"
: > "$LOG_FILE"
: > "$SUMMARY_FILE"

echo "[start] $(date -Is)" | tee -a "$LOG_FILE"
echo "[root] $ROOT_DIR" | tee -a "$LOG_FILE"
echo "[port] $PORT" | tee -a "$LOG_FILE"
echo "[duration_seconds] $DURATION_SECONDS" | tee -a "$LOG_FILE"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "[server] starting local http.server on :$PORT" | tee -a "$LOG_FILE"
  (
    cd "$ROOT_DIR"
    python3 -m http.server "$PORT"
  ) >> "$LOG_FILE" 2>&1 &
  SERVER_PID="$!"
  sleep 2
else
  echo "[server] reusing existing server on :$PORT" | tee -a "$LOG_FILE"
fi

end_epoch=$(( $(date +%s) + DURATION_SECONDS ))
run=0
while [[ $(date +%s) -lt $end_epoch ]]; do
  run=$((run + 1))
  echo "[run $run] $(date -Is)" | tee -a "$LOG_FILE"

  PLAYTEST_ARGS=("http://127.0.0.1:${PORT}/")
  if [[ "$HEADLESS_FLAG" == "--headed=1" ]]; then
    PLAYTEST_ARGS+=("--headed" "--watch")
    if [[ "$SLOW_MO" != "0" ]]; then
      PLAYTEST_ARGS+=("--slow=${SLOW_MO}")
    fi
  fi

  if node "$ROOT_DIR/scripts/playtest.js" "${PLAYTEST_ARGS[@]}" >> "$SUMMARY_FILE" 2>> "$LOG_FILE"; then
    echo "[run $run] ok" | tee -a "$LOG_FILE"
  else
    echo "[run $run] fail" | tee -a "$LOG_FILE"
  fi

  sleep 2
done

echo "[end] $(date -Is)" | tee -a "$LOG_FILE"
