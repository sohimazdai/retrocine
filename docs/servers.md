# Серверы и выкладка

Секретов в этом файле нет: пароли и ключи сервисов лежат только на серверах (или в вашем менеджере паролей).

| | VPS в Амстердаме (planner + фронт kinō) | VPS в Москве (сервер kinō) |
|---|---|---|
| Адрес | `45.159.189.71`, `sohimazdai.ru` | `185.209.160.44`, `api.sohimazdai.ru` |
| Где | king-servers, Амстердам | тот же хостер, Москва |
| Система | Ubuntu 24.04, 1 ядро, 2 ГБ | Ubuntu 20.04, 4 ядра, 3,8 ГБ, 117 ГБ |
| Вход владельца | `ssh vps@45.159.189.71` | `ssh vps@185.209.160.44` (root — только по ключу) |
| Что крутится | planner (`planform.service`), Caddy | `retrocine-sync`, `livekit`, Caddy |
| kinō | статика `/var/www/cine` → `https://sohimazdai.ru/cine/` | `wss://api.sohimazdai.ru/ws`, `/rtc`, `/health` |

DNS — Cloudflare, записи `sohimazdai.ru`, `www` → 45.159.189.71 и `api` → 185.209.160.44, все в режиме **DNS only** (серое облако): так меньше задержка, и трафик из России не упирается в замедление Cloudflare.

**Почему сервер в Москве.** Первый сервер стоял в Амстердаме (185.209.162.2), но его адрес блокировали российские операторы (ТСПУ): соединение устанавливалось, а данные не шли, на любом порту. Страница открывалась, комната — нет; работало только через зарубежный VPN. Адрес в Москве доступен из всех проверенных российских сетей. Проверять доступность из России удобно через [Globalping](https://globalping.io) (узлы в домашних и облачных сетях РФ) и check-host.net.

## Выкатить новую версию

Одна команда из папки проекта:

```bash
./deploy/deploy.sh                # текущий коммит: тесты → сервер → фронт → проверка версий
./deploy/deploy.sh origin/main    # другой коммит или ветка
./deploy/deploy.sh --api | --web  # только сервер / только фронт
./deploy/deploy.sh --no-check     # без тестов
./deploy/deploy.sh --status       # что работает
./deploy/deploy.sh --logs 200     # журнал сервера синхронизации
./deploy/deploy.sh --rollback     # вернуть предыдущие релизы
```

Скрипт берёт архив коммита (`git archive`) — незакоммиченные правки не попадают, и предупреждает, если коммит ещё не на GitHub. Тесты (`npm run check`) прогоняются именно на этом коммите во временной папке; если они не прошли, ничего не выкатывается. В конце скрипт сверяет, что `https://api.sohimazdai.ru/health` и `https://sohimazdai.ru/cine/RELEASE` отвечают новой версией.

Хосты — `CINE_API_HOST` (по умолчанию `vps@185.209.160.44`) и `CINE_WEB_HOST` (`vps@45.159.189.71`). Пользователю `vps` через sudo без пароля разрешены только `retrocine-deploy` и `cine-deploy`. SSH-соединение к каждому серверу открывается один раз на всю выкладку; чтобы пароль не спрашивался совсем, один раз выполните `ssh-copy-id vps@185.209.160.44` и `ssh-copy-id vps@45.159.189.71`.

- **Сервер** (`retrocine-deploy`): распаковка в `/opt/retrocine/releases/<время>-<коммит>`, `npm ci --omit=dev`, переключение `/opt/retrocine/current`, перезапуск, проверка `/health` до 15 с, иначе откат. Хранятся 5 релизов. Журнал — `/var/log/retrocine-deploy.log`.
- **Фронт** (`cine-deploy`): папка `dist/` в `/var/www/cine-releases/<время>-<коммит>`, атомарное переключение симлинка `/var/www/cine`. Planner не затрагивается.

Подключённые в этот момент участники переподключаются сами за 1–2 с и сохраняют свою идентичность.

## Сервер kinō: что где

| Что | Где |
|---|---|
| Сервер синхронизации | `retrocine-sync.service`, `127.0.0.1:8090`, пользователь `retrocine`, код `/opt/retrocine/current` |
| Данные комнат | `/var/lib/retrocine/rooms/<id>.json` |
| Настройки и секреты | `/etc/retrocine/retrocine.env` (root:retrocine 640): порт, Origin, ключ и секрет LiveKit |
| LiveKit | `livekit.service`, конфиг `/etc/livekit.yaml` (тот же ключ), сигналинг `127.0.0.1:7880` |
| HTTPS | Caddy (`/etc/caddy/Caddyfile`), сертификат Let's Encrypt обновляется сам |
| Firewall (ufw) | 22, 80, 443/tcp; 7881/tcp; 7882/udp; 3478/udp; 30000–30999/udp |
| Сеть | `/etc/sysctl.d/90-retrocine.conf`: BBR, fq, буферы UDP |

Установка с нуля: скопировать `deploy/api/` на сервер и выполнить `sudo bash setup.sh` (повторный запуск безопасен; проверено на Ubuntu 20.04 и 24.04), затем `./deploy/deploy.sh --api`. На Ubuntu 20.04 закончились бесплатные обновления безопасности — при случае стоит переустановить сервер на 24.04 и повторить эти два шага. Для старого сервера — `deploy/web/setup.sh`: добавляет в существующий Caddyfile блок `/cine/` и команду `cine-deploy`.

## Если что-то сломалось

- **Комната не подключается.** `curl https://api.sohimazdai.ru/health`, затем `./deploy/deploy.sh --status` и `--logs`. Быстрый выход — `--rollback`.
- **Нет звука и видео, а сцена работает.** `systemctl status livekit`, `journalctl -u livekit -n 100`. Проверить, что UDP 7882 открыт: `ufw status`.
- **Самопроверка медиа на сервере:** `lk load-test --url wss://api.sohimazdai.ru --api-key … --api-secret … --room selftest --video-publishers 1 --subscribers 2 --duration 15s` (ключи — в `/etc/retrocine/retrocine.env`).
- **Сертификат.** `journalctl -u caddy`.

## Доступ Claude

Из среды Claude наружу проходит только HTTPS на 443, поэтому SSH обёрнут в WebSocket: Caddy на каждом сервере пробрасывает секретный путь `/_ssh/<секрет>` на маленький мост (`ssh-ws.service`) к локальному sshd. Вход по-прежнему только по ключу.

- Ключ Claude и секрет пути лежат у владельца в `~/projects/retrocine/.secrets/` (в git не попадают). Новая сессия Claude берёт их оттуда, когда ей дают доступ к папке проекта.
- Подключение: `ProxyCommand python3 ws-proxy.py wss://sohimazdai.ru/_ssh/<секрет>` для старого сервера и `wss://api.sohimazdai.ru/_ssh/<секрет>` для московского (или через амстердамский: `ProxyJump`). Готовый `ssh_config` — в той же папке.
- Отозвать доступ: удалить строку `claude-retrocine` из `/root/.ssh/authorized_keys` на обоих серверах; выключить мост: `systemctl disable --now ssh-ws`.
