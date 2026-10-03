#!/usr/bin/env bash
# Выкладка сайта (веб-версия приложения) на машину ядра.
#
#   deploy/deploy-web.sh test   — сборка с тестовым ядром → https://test.denvise.ru
#   deploy/deploy-web.sh prod   — сборка с боевым ядром   → https://denvise.ru
#
# Собирается из рабочей папки; если в приложении есть незакоммиченные правки — отказ.
# Сборки разные (адрес ядра зашит в сборку), поэтому prod собирается отдельно,
# но из того же коммита, что был проверен на test.
set -euo pipefail

cd "$(dirname "$0")/.."
TARGET="${1:-}"
case "$TARGET" in
  test) CORE_URL="https://test-api.denvise.ru"; OTHER_URL="https://api.denvise.ru"; SITE="https://test.denvise.ru" ;;
  prod) CORE_URL="https://api.denvise.ru"; OTHER_URL="https://test-api.denvise.ru"; SITE="https://denvise.ru" ;;
  *) echo "Использование: deploy/deploy-web.sh test|prod"; exit 1 ;;
esac
[[ -f deploy/.vm ]] || { echo "Нет deploy/.vm с IP машины"; exit 1; }
VM="denvise@$(tr -d '[:space:]' < deploy/.vm)"
SSH=(ssh -i ~/.ssh/denvise_vm -o StrictHostKeyChecking=accept-new "$VM")
SCP=(scp -i ~/.ssh/denvise_vm -o StrictHostKeyChecking=accept-new)

SHA="$(git rev-parse --short HEAD)"
# Незакоммиченные правки приложения не выкладываем: на сайте должно быть
# ровно то, что лежит в коммите (ядро, выкладка и сервер ДентИИ не в счёт)
DIRTY="$(git status --porcelain -- . ":!core" ":!deploy" ":!server" ":!*.md")"
[[ -z "$DIRTY" ]] || { echo "Есть незакоммиченные правки приложения:"; echo "$DIRTY"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Сборка сайта ($TARGET) из коммита $SHA…"
# --clear обязателен: иначе сборщик берёт из кеша файлы с адресом ядра прошлой сборки
EXPO_PUBLIC_CORE_URL="$CORE_URL" CI=1 npx expo export -p web --clear --output-dir "$WORK/dist" >/dev/null
grep -rq "$CORE_URL" "$WORK/dist/_expo" || { echo "ОШИБКА: в сборке нет адреса ядра $CORE_URL"; exit 1; }
! grep -rqF "\"$OTHER_URL" "$WORK/dist/_expo" || { echo "ОШИБКА: в сборке адрес чужого ядра $OTHER_URL"; exit 1; }
BUNDLE="$(grep -o "/_expo/static/js/web/[^\"]*.js" "$WORK/dist/index.html" | head -1)"

tar -czf "$WORK/web.tgz" -C "$WORK/dist" .
"${SCP[@]}" deploy/compose.yaml deploy/Caddyfile "$VM:/opt/denvise/"
"${SCP[@]}" "$WORK/web.tgz" "$VM:/opt/denvise/web-$TARGET.tgz"
"${SSH[@]}" bash -se <<EOF
set -euo pipefail
cd /opt/denvise
mkdir -p web/prod web/test
rm -rf web/$TARGET.new && mkdir web/$TARGET.new && tar -xzf web-$TARGET.tgz -C web/$TARGET.new
# Подмена содержимого (а не каталога): Caddy видит папку через монтирование
rm -rf web/$TARGET.old && mkdir web/$TARGET.old
find web/$TARGET -mindepth 1 -maxdepth 1 -exec mv {} web/$TARGET.old/ \;
find web/$TARGET.new -mindepth 1 -maxdepth 1 -exec mv {} web/$TARGET/ \;
rm -rf web/$TARGET.new web/$TARGET.old web-$TARGET.tgz
docker compose up -d caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null
EOF

# Ждём, пока сайт начнёт отдавать именно новую сборку
for _ in $(seq 1 30); do
  if curl -fsS --max-time 8 "$SITE/" | grep -qF "$BUNDLE"; then echo "OK: $SITE ($SHA)"; exit 0; fi
  sleep 4
done
echo "ОШИБКА: $SITE не отдаёт новую сборку"; exit 1
