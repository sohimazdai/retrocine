# Серверы и выкладка

Секретов в этом файле нет: пароли и ключи сервисов лежат только на серверах (или в вашем менеджере паролей).

| | Старый VPS (planner + фронт kinō) | Новый VPS (сервер kinō) |
|---|---|---|
| Адрес | `45.159.189.71`, `sohimazdai.ru` | `185.209.162.2`, `api.sohimazdai.ru` |
| Где | king-servers, Амстердам | Амстердам (тот же ДЦ, 0,3 мс между ними) |
| Система | Ubuntu 24.04, 1 ядро, 2 ГБ | Ubuntu 24.04, 4 ядра, 3,8 ГБ, 116 ГБ |
| Вход владельца | `ssh vps@45.159.189.71` | `ssh vps@185.209.162.2` |
| Что крутится | planner (`planform.service`), Caddy | `retrocine-sync`, `livekit`, Caddy |
| kinō | статика `/var/www/cine` → `https://sohimazdai.ru/cine/` | `wss://api.sohimazdai.ru/ws`, `/rtc`, `/health` |

DNS — Cloudflare, записи `sohimazdai.ru`, `www` → 45.159.189.71 и `api` → 185.209.162.2, все в режиме **DNS only** (серое облако): так меньше задержка, и трафик из России не упирается в замедление Cloudflare.

## Выкатить новую версию

```bash
./deploy/deploy.sh                # origin/main: сервер и фронт
./deploy/deploy.sh HEAD           # текущий коммит
./deploy/deploy.sh --api | --web  # только сервер / только фронт
./deploy/deploy.sh --status       # что работает
./deploy/deploy.sh --logs 200     # журнал сервера синхронизации
./deploy/deploy.sh --rollback     # вернуть предыдущие релизы
```

Код уходит архивом коммита (`git archive`), незакоммиченные правки не попадают. Хосты — `CINE_API_HOST` (по умолчанию `vps@185.209.162.2`) и `CINE_WEB_HOST` (`vps@45.159.189.71`). Пользователю `vps` через sudo без пароля разрешены только `retrocine-deploy` и `cine-deploy`.

- **Сервер** (`retrocine-deploy`): распаковка в `/opt/retrocine/releases/<время>-<коммит>`, `npm ci --omit=dev`, переключение `/opt/retrocine/current`, перезапуск, проверка `/health` до 15 с, иначе откат. Хранятся 5 релизов. Журнал — `/var/log/retrocine-deploy.log`.
- **Фронт** (`cine-deploy`): папка `dist/` в `/var/www/cine-releases/<время>-<коммит>`, атомарное переключение симлинка `/var/www/cine`. Planner не затрагивается.

Подключённые в этот момент участники переподключаются сами за 1–2 с и сохраняют свою идентичность.

## Новый сервер: что где

| Что | Где |
|---|---|
| Сервер синхронизации | `retrocine-sync.service`, `127.0.0.1:8090`, пользователь `retrocine`, код `/opt/retrocine/current` |
| Данные комнат | `/var/lib/retrocine/rooms/<id>.json` |
| Настройки и секреты | `/etc/retrocine/retrocine.env` (root:retrocine 640): порт, Origin, ключ и секрет LiveKit |
| LiveKit | `livekit.service`, конфиг `/etc/livekit.yaml` (тот же ключ), сигналинг `127.0.0.1:7880` |
| HTTPS | Caddy (`/etc/caddy/Caddyfile`), сертификат Let's Encrypt обновляется сам |
| Firewall (ufw) | 22, 80, 443/tcp; 7881/tcp; 7882/udp; 3478/udp; 30000–30999/udp |
| Сеть | `/etc/sysctl.d/90-retrocine.conf`: BBR, fq, буферы UDP |

Установка с нуля: скопировать `deploy/api/` на сервер и выполнить `sudo bash setup.sh` (повторный запуск безопасен), затем `./deploy/deploy.sh --api`. Для старого сервера — `deploy/web/setup.sh`: добавляет в существующий Caddyfile блок `/cine/` и команду `cine-deploy`.

## Если что-то сломалось

- **Комната не подключается.** `curl https://api.sohimazdai.ru/health`, затем `./deploy/deploy.sh --status` и `--logs`. Быстрый выход — `--rollback`.
- **Нет звука и видео, а сцена работает.** `systemctl status livekit`, `journalctl -u livekit -n 100`. Проверить, что UDP 7882 открыт: `ufw status`.
- **Самопроверка медиа на сервере:** `lk load-test --url wss://api.sohimazdai.ru --api-key … --api-secret … --room selftest --video-publishers 1 --subscribers 2 --duration 15s` (ключи — в `/etc/retrocine/retrocine.env`).
- **Сертификат.** `journalctl -u caddy`.

## Доступ Claude

Из среды Claude наружу проходит только HTTPS на 443, поэтому SSH обёрнут в WebSocket: Caddy на каждом сервере пробрасывает секретный путь `/_ssh/<секрет>` на маленький мост (`ssh-ws.service`) к локальному sshd. Вход по-прежнему только по ключу.

- Ключ Claude и секрет пути лежат у владельца в `~/projects/retrocine/.secrets/` (в git не попадают). Новая сессия Claude берёт их оттуда, когда ей дают доступ к папке проекта.
- Подключение: `ProxyCommand python3 ws-proxy.py wss://sohimazdai.ru/_ssh/<секрет>` для старого сервера и `wss://api.sohimazdai.ru/_ssh/<секрет>` для нового (или через старый: `ProxyJump`). Готовый `ssh_config` — в той же папке.
- Отозвать доступ: удалить строку `claude-retrocine` из `/root/.ssh/authorized_keys` на обоих серверах; выключить мост: `systemctl disable --now ssh-ws`.
