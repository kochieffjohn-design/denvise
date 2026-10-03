# Выкладка ядра Denvise (Yandex Cloud)

Машина: Ubuntu 24.04, Docker. В `/opt/denvise`:

| Что | Где |
|---|---|
| Caddy — HTTPS для ядра (`api`, `test-api`) и сайта (`denvise.ru`, `test.denvise.ru`, `www` → `denvise.ru`) | `compose.yaml`, `Caddyfile` (копируются при каждой выкладке) |
| Сайт: сборки веб-версии приложения | `web/prod`, `web/test` |
| Боевое ядро `core` (образ `denvise-core:prod`) | `env/prod.env` — секреты, только на машине |
| Тестовое ядро `core-test` (образ `denvise-core:test`) | `env/test.env` — секреты, только на машине |

Машина настраивается при создании файлом `cloud-init.yaml`: Docker, автообновления безопасности (перезагрузка, если нужна, в 04:30 МСК), ротация логов.

## Как выкладывать

```bash
deploy/deploy.sh test   # последний коммит → test-api.denvise.ru, ждёт /health
deploy/deploy.sh prod   # тот же образ, что на тесте → api.denvise.ru
```

Сайт (веб-версия приложения) выкладывается отдельно — адрес ядра зашит в сборку, поэтому сборки разные:

```bash
deploy/deploy-web.sh test   # сборка с test-api → test.denvise.ru
deploy/deploy-web.sh prod   # сборка с api → denvise.ru
```

В бой попадает только то, что уже проверено на тесте. Выкладывается закоммиченный код (`git archive`).

Нужны локально (не в git): `deploy/.vm` с IP машины и SSH-ключ `~/.ssh/denvise_vm`.

## Секреты

Ключей доступа к облаку на машине нет: ей назначен сервисный аккаунт `denvise-core` (отправка писем через Postbox), токен ядро берёт из метаданных машины. Пароль базы и ключ сессий — в `env/*.env` на машине, права 600.
