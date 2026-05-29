#!/usr/bin/env bash
# يضمن تشغيل Redis لطابور OCR — أو يفعّل OCR_INLINE_EXTRACTION كاحتياط
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
ENV_FILE="$REPO/backend/.env"

set_env_var() {
  local key="$1"
  local value="$2"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "WARN: missing $ENV_FILE — skip $key"
    return 1
  fi
  if grep -q "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^[[:space:]]*${key}[[:space:]]*=.*|${key}=${value}|" "$ENV_FILE"
    echo "==> Updated ${key}=${value} in .env"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    echo "==> Appended ${key}=${value} to .env"
  fi
}

REDIS_OK=0

if command -v docker >/dev/null 2>&1 && [[ -f "$REPO/docker-compose.yml" ]]; then
  echo "==> Starting Redis via docker compose"
  (cd "$REPO" && docker compose up -d redis) || (cd "$REPO" && docker-compose up -d redis) || true
  sleep 2
  if (cd "$REPO" && docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG) \
    || (cd "$REPO" && docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG); then
    REDIS_OK=1
    echo "==> Redis responded to PING"
    set_env_var "REDIS_HOST" "127.0.0.1" || true
    set_env_var "REDIS_PORT" "6379" || true
    set_env_var "OCR_INLINE_EXTRACTION" "false" || true
  fi
fi

if [[ "$REDIS_OK" != 1 ]]; then
  echo "==> Redis not available — OCR_INLINE_EXTRACTION=true (direct extraction + sweeper)"
  set_env_var "OCR_INLINE_EXTRACTION" "true" || true
fi

echo "==> OCR queue infra check done (redis_ok=${REDIS_OK})"
