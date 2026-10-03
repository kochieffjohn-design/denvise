#!/usr/bin/env bash
# Промокоды и ручная выдача Pro (см. core/src/cli/promo.ts):
#   deploy/promo.sh prod create --days 90 --uses 10 --note "друзья"
#   deploy/promo.sh prod list
#   deploy/promo.sh test grant --email someone@example.com --days 30
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-}"; shift || true
case "$TARGET" in
  prod) SERVICE=core ;;
  test) SERVICE=core-test ;;
  *) echo "Использование: deploy/promo.sh test|prod create|list|grant …"; exit 1 ;;
esac
VM="denvise@$(tr -d '[:space:]' < deploy/.vm)"
ARGS=$(printf '%q ' "$@")
ssh -i ~/.ssh/denvise_vm "$VM" "cd /opt/denvise && docker compose exec -T $SERVICE node --import tsx src/cli/promo.ts $ARGS"
