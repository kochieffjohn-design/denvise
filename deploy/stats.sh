#!/usr/bin/env bash
# Сводка аналитики: deploy/stats.sh prod [дней=30]   (или test)
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in prod) SERVICE=core ;; test) SERVICE=core-test ;; *) echo "Использование: deploy/stats.sh test|prod [дней]"; exit 1 ;; esac
VM="denvise@$(tr -d '[:space:]' < deploy/.vm)"
ssh -i ~/.ssh/denvise_vm "$VM" "cd /opt/denvise && docker compose exec -T $SERVICE node --import tsx src/cli/stats.ts ${2:-30}"
