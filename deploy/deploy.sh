#!/usr/bin/env bash
# Выкладка ядра на машину в Yandex Cloud.
#
#   deploy/deploy.sh test   — собрать ядро из последнего коммита и запустить на test-api.denvise.ru
#   deploy/deploy.sh prod   — перенести в бой ТОТ ЖЕ образ, что сейчас на тесте (api.denvise.ru)
#
# Выкладывается только закоммиченный код (git archive), незакоммиченные правки не попадут.
# Нужны: IP машины в deploy/.vm (файл не в git) и ключ ~/.ssh/denvise_vm.
set -euo pipefail

cd "$(dirname "$0")/.."
TARGET="${1:-}"
[[ "$TARGET" == "test" || "$TARGET" == "prod" ]] || { echo "Использование: deploy/deploy.sh test|prod"; exit 1; }
[[ -f deploy/.vm ]] || { echo "Нет deploy/.vm с IP машины"; exit 1; }
VM="denvise@$(tr -d '[:space:]' < deploy/.vm)"
SSH=(ssh -i ~/.ssh/denvise_vm -o StrictHostKeyChecking=accept-new "$VM")
SCP=(scp -i ~/.ssh/denvise_vm -o StrictHostKeyChecking=accept-new)

# Конфигурация машины (compose, Caddy) обновляется при каждой выкладке
"${SCP[@]}" deploy/compose.yaml deploy/Caddyfile "$VM:/opt/denvise/"

wait_healthy() { # $1 — адрес
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "$1/health" >/dev/null 2>&1; then echo "OK: $1/health"; return 0; fi
    sleep 4
  done
  echo "ОШИБКА: $1/health не отвечает"; return 1
}

if [[ "$TARGET" == "test" ]]; then
  SHA="$(git rev-parse --short HEAD)"
  echo "Сборка ядра из коммита $SHA…"
  git archive --format=tar.gz HEAD:core > /tmp/denvise-core.tgz
  "${SCP[@]}" /tmp/denvise-core.tgz "$VM:/opt/denvise/core.tgz"
  "${SSH[@]}" bash -se <<EOF
set -euo pipefail
cd /opt/denvise
rm -rf core-src && mkdir core-src && tar -xzf core.tgz -C core-src
docker build -q -t denvise-core:$SHA core-src
docker tag denvise-core:$SHA denvise-core:test
# Боевого образа ещё нет (первая выкладка) — не даём compose упасть
docker image inspect denvise-core:prod >/dev/null 2>&1 || docker tag denvise-core:$SHA denvise-core:prod
docker compose up -d core-test caddy
EOF
  wait_healthy https://test-api.denvise.ru
else
  echo "Перенос в бой образа, проверенного на тесте…"
  "${SSH[@]}" bash -se <<'EOF'
set -euo pipefail
cd /opt/denvise
docker tag denvise-core:test denvise-core:prod
docker compose up -d core caddy
docker image prune -f >/dev/null
EOF
  wait_healthy https://api.denvise.ru
fi
