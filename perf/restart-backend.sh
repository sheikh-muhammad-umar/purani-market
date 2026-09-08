#!/usr/bin/env bash
# Restarts the perf-test backend instance on PORT (default 3100).
#
# Only ever touches the process listening on $PORT, resolved via lsof, so the
# developer's own instance on :3000 is never affected. The PID is read back from
# the listening socket rather than $! because the launch runs in a subshell and
# $! is the subshell, not node -- which previously left a stale server running
# with the wrong throttle settings and silently invalidated a whole run.
set -uo pipefail

PORT="${PORT:-3100}"
THROTTLE_LIMIT_VAL="${THROTTLE_DEFAULT_LIMIT:-5000000}"
THROTTLE_TTL_VAL="${THROTTLE_DEFAULT_TTL:-60000}"
LOGNAME="${LOGNAME_SUFFIX:-run}"

if [ "$PORT" = "3000" ]; then
  echo "refusing to operate on port 3000 (developer instance)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
mkdir -p perf/logs perf/results

# Stop whatever currently holds the port.
OLD=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$OLD" ]; then
  echo "stopping existing listener(s) on :$PORT -> $OLD"
  # shellcheck disable=SC2086
  kill $OLD 2>/dev/null || true
  for _ in $(seq 1 20); do
    sleep 0.5
    STILL=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
    [ -z "$STILL" ] && break
  done
  STILL=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$STILL" ]; then
    echo "force stopping $STILL"
    # shellcheck disable=SC2086
    kill -9 $STILL 2>/dev/null || true
    sleep 2
  fi
fi

cd "$ROOT/backend" || exit 1
# LOG_DEST=discard sends stdout to /dev/null. Node writes to a regular file
# synchronously, so this isolates the cost of the per-request logger's blocking
# write without touching application code or configuration.
if [ "${LOG_DEST:-file}" = "discard" ]; then
  OUT="/dev/null"
else
  OUT="$ROOT/perf/logs/backend-$LOGNAME.log"
fi
echo "stdout -> $OUT"
PORT="$PORT" \
THROTTLE_DEFAULT_LIMIT="$THROTTLE_LIMIT_VAL" \
THROTTLE_DEFAULT_TTL="$THROTTLE_TTL_VAL" \
  nohup node --enable-source-maps dist/main \
  > "$OUT" 2>&1 &

# Wait for the port to accept connections, then resolve the real node pid.
BOOTED=0
for _ in $(seq 1 60); do
  sleep 1
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    BOOTED=1
    break
  fi
done

if [ "$BOOTED" != "1" ]; then
  echo "backend failed to listen on :$PORT" >&2
  tail -25 "$ROOT/perf/logs/backend-$LOGNAME.log" >&2
  exit 1
fi

PID=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
echo "$PID" > "$ROOT/perf/logs/backend.pid"
echo "backend listening on :$PORT pid=$PID throttleLimit=$THROTTLE_LIMIT_VAL ttl=$THROTTLE_TTL_VAL"
ps -o pid=,command= -p "$PID" | cut -c1-140
