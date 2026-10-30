# Аналитика приложений

Общая аналитика для приложений на sohimazdai.ru: retrocine, planner и следующих. Графики — в Grafana на https://stats.sohimazdai.ru/ (дашборд «Аналитика приложений»).

```
браузер planner ──POST /a/e──┐                        ┌── Grafana (SQLite-источник, только чтение)
сервер retrocine ─POST /a/s──┼──► сервис аналитики ──► /var/lib/analytics/events.db
агенты Caddy (оба сервера) ──┘    127.0.0.1:8095       (московский сервер)
```

## Что собирается

| Метрика | Откуда | Событие |
|---|---|---|
| RPM по урлам | журнал Caddy на каждом сервере → агент раз в минуту | `http` (value — запросов за минуту, path, host, статус) |
| Уникальные посетители в день | planner: случайный id в localStorage браузера; retrocine: вход в комнату | любые события с `uid` (на сервере только хеш с солью) |
| retrocine: открытые комнаты | сервер, когда комната поднимается | `room.open` |
| retrocine: запущенные снаряды | сервер, бросок | `throw` (`w` — что бросили) |
| retrocine: текущий онлайн | сервер раз в 30 с | gauge `online`, `rooms` |
| retrocine: километры | сервер по позам (рывки больше 4 м — телепорт, не считаются) | `distance` (value — метры, `mode`: foot, kart, skateboard, scooter, bike, sled, zipline) |
| planner: размеченные планы | распознали стены на загруженном плане | `plan.marked` (`developer`, число стен, проёмов, мебели) |
| planner: взаимодействия | любая правка плана, отделка, выбор застройщика | `edit` (`what`: furniture, wall, window, door, opening, finish, scale, developer) |

Содержимое планов, имена, комнаты и IP не сохраняются.

## Подключить новое приложение

1. Добавить имя в `ANALYTICS_APPS` (`/etc/analytics/analytics.env`) и перезапустить `analytics`.
2. Из браузера — `POST https://stats.sohimazdai.ru/a/e` с телом `{ app, uid, events: [{ n, p?, v?, k? }] }` (готовый клиент — `lib/analytics.ts` в planner). Origin должен быть в `ANALYTICS_ORIGINS`.
3. С сервера — `POST /a/s` с заголовком `Authorization: Bearer <ANALYTICS_TOKEN>`: `{ app, events: [{ n, uid?, p?, v?, k?, ts? }], gauges: [{ n, v, ts? }] }` (пример — `server/src/analytics.js`).
4. RPM — строкой в `AGENT_MAP` агента на сервере, где стоит приложение (`хост/путь=приложение`).
5. Панели — в `grafana/build-dashboard.mjs`, затем `node analytics/grafana/build-dashboard.mjs` и выкладка.

Имена событий: латиница, цифры, `._:-`, до 48 символов; свойства `k` — до 8 ключей, строки до 64 символов. Данные хранятся 400 дней.

## Установка и обновление

```bash
./deploy/analytics/deploy.sh        # с компьютера разработчика; спросит пароль sudo на обоих серверах
```

Перед первой установкой в Cloudflare нужна запись `stats` → `185.209.160.44` (DNS only). Скрипт ставит на московский сервер сервис, Grafana с плагином SQLite (пакет скачивается через амстердамский сервер: из России репозиторий Grafana закрыт), агент журнала Caddy, подключает retrocine (`ANALYTICS_URL`/`ANALYTICS_TOKEN` в `/etc/retrocine/retrocine.env`) и ставит агент на сервер sohimazdai.ru. Пароль администратора Grafana выводится при первой установке и лежит в `/etc/grafana/grafana.ini`.

Проверка: `curl https://stats.sohimazdai.ru/a/health`, `systemctl status analytics analytics-agent grafana-server`, журнал — `journalctl -u analytics`.
Тесты: `node --test analytics/test/*.test.mjs` (входят в `npm run check`).
