#!/usr/bin/env bash
# Integration test: verify Docker build and compose setup
set -euo pipefail

COMPOSE_PROJECT="marketplace-test-$$"
PASS=0
FAIL=0

cleanup() {
  echo "--- Cleaning up ---"
  docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml down -v --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

log_pass() { echo "✅ PASS: $1"; PASS=$((PASS + 1)); }
log_fail() { echo "❌ FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== Test 1: Backend Dockerfile builds successfully ==="
if docker build -t marketplace-backend-test ./backend; then
  log_pass "Backend Docker image builds"
else
  log_fail "Backend Docker image build"
fi

echo ""
echo "=== Test 2: docker-compose.yml is valid ==="
if docker compose -f docker-compose.yml config --quiet; then
  log_pass "docker-compose.yml is valid"
else
  log_fail "docker-compose.yml validation"
fi

echo ""
echo "=== Test 3: Staging override is valid ==="
if docker compose -f docker-compose.yml -f docker-compose.staging.yml config --quiet; then
  log_pass "Staging compose override is valid"
else
  log_fail "Staging compose override validation"
fi

echo ""
echo "=== Test 4: Production override is valid ==="
# Production uses env vars — provide defaults for validation
export MONGO_ROOT_USER=test MONGO_ROOT_PASSWORD=test REDIS_PASSWORD=test
if docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet; then
  log_pass "Production compose override is valid"
else
  log_fail "Production compose override validation"
fi

echo ""
echo "=== Test 5: Services start and become healthy ==="
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml up -d mongodb redis elasticsearch

HEALTHY=true
for svc in mongodb redis elasticsearch; do
  echo "Waiting for $svc to be healthy..."
  TRIES=0
  while [ $TRIES -lt 30 ]; do
    STATUS=$(docker compose -p "$COMPOSE_PROJECT" ps --format json "$svc" 2>/dev/null | head -1 | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
      break
    fi
    TRIES=$((TRIES + 1))
    sleep 2
  done
  if [ "$STATUS" = "healthy" ]; then
    log_pass "$svc is healthy"
  else
    log_fail "$svc health check (status: $STATUS)"
    HEALTHY=false
  fi
done

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo "==============================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
