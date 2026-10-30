#!/usr/bin/env bash
# Аналитика на московском сервере (api.sohimazdai.ru): сервис приёма событий, Grafana с дашбордом,
# агент журнала Caddy и подключение retrocine. Запуск от root из распакованной папки (её привозит
# deploy/analytics/deploy.sh); повторный запуск безопасен.
#   GRAFANA_DEB — путь к пакету Grafana, если apt-репозиторий Grafana недоступен (из России закрыт).
#   SQLITE_PLUGIN_ZIP — архив плагина frser-sqlite-datasource (если GitHub недоступен).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../../analytics"
DOMAIN="${STATS_DOMAIN:-stats.sohimazdai.ru}"
PLUGIN_VERSION="${SQLITE_PLUGIN_VERSION:-3.5.0}"

# 1. Сервис приёма событий.
id analytics >/dev/null 2>&1 || useradd --system --home /var/lib/analytics --shell /usr/sbin/nologin analytics
install -d -m 750 -o analytics -g analytics /var/lib/analytics
install -d -m 755 /opt/analytics /etc/analytics
rm -rf /opt/analytics/src /opt/analytics/agent
cp -r "$SRC/src" "$SRC/agent" /opt/analytics/
if [ ! -f /etc/analytics/analytics.env ]; then
  # Секреты: файл закрыт с самого начала (без umask на весь скрипт: от него Caddy не мог прочитать свой файл).
  install -m 600 /dev/null /etc/analytics/analytics.env
  cat > /etc/analytics/analytics.env <<ENV
ANALYTICS_PORT=8095
ANALYTICS_DB=/var/lib/analytics/events.db
ANALYTICS_APPS=retrocine,planner
ANALYTICS_ORIGINS=https://sohimazdai.ru,https://www.sohimazdai.ru
ANALYTICS_TOKEN=$(openssl rand -hex 24)
ANALYTICS_SALT=$(openssl rand -hex 24)
ENV
  chgrp analytics /etc/analytics/analytics.env && chmod 640 /etc/analytics/analytics.env
fi
TOKEN="$(grep ^ANALYTICS_TOKEN= /etc/analytics/analytics.env | cut -d= -f2)"
install -m 644 "$HERE/analytics.service" /etc/systemd/system/analytics.service

# 2. Агент журнала Caddy (RPM по урлам этого сервера).
install -d -m 755 /var/log/caddy && chown caddy:caddy /var/log/caddy 2>/dev/null || true
cat > /etc/analytics/agent.env <<ENV
AGENT_LOG=/var/log/caddy/access.log
AGENT_URL=http://127.0.0.1:8095/a/s
AGENT_TOKEN=${TOKEN}
AGENT_MAP=api.sohimazdai.ru=retrocine
ENV
chmod 600 /etc/analytics/agent.env
install -m 644 "$HERE/analytics-agent.service" /etc/systemd/system/analytics-agent.service

# 3. retrocine шлёт свои события в сервис.
RENV=/etc/retrocine/retrocine.env
if [ -f "$RENV" ] && ! grep -q '^ANALYTICS_TOKEN=' "$RENV"; then
  printf 'ANALYTICS_URL=http://127.0.0.1:8095/a/s\nANALYTICS_TOKEN=%s\n' "$TOKEN" >> "$RENV"
fi
# Работающий retrocine без этих настроек (запущен до них) перезапускается: участники переподключатся за 1–2 с.
PID="$(systemctl show -p MainPID --value retrocine-sync 2>/dev/null || echo 0)"
if [ "${PID:-0}" != 0 ] && ! tr '\0' '\n' < "/proc/$PID/environ" | grep -q '^ANALYTICS_TOKEN='; then RESTART_RETRO=1; fi

# 4. Grafana с источником SQLite и дашбордом.
if ! dpkg -s grafana >/dev/null 2>&1; then
  if [ -n "${GRAFANA_DEB:-}" ]; then apt-get install -y -qq "$GRAFANA_DEB" >/dev/null
  else
    apt-get install -y -qq apt-transport-https gpg >/dev/null
    curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /usr/share/keyrings/grafana.gpg
    echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list
    apt-get update -qq && apt-get install -y -qq grafana >/dev/null
  fi
fi
PLUGDIR=/var/lib/grafana/plugins/frser-sqlite-datasource
if [ ! -d "$PLUGDIR" ]; then
  ZIP="${SQLITE_PLUGIN_ZIP:-/tmp/frser-sqlite.zip}"
  [ -f "$ZIP" ] || curl -fsSLo "$ZIP" "https://github.com/fr-ser/grafana-sqlite-datasource/releases/download/v${PLUGIN_VERSION}/frser-sqlite-datasource-${PLUGIN_VERSION}.zip"
  command -v unzip >/dev/null || apt-get install -y -qq unzip >/dev/null
  unzip -qo "$ZIP" -d /var/lib/grafana/plugins/ && chown -R grafana:grafana /var/lib/grafana/plugins
fi
# Grafana читает базу событий: группа analytics, только чтение (WAL требует доступа к каталогу).
usermod -aG analytics grafana
chmod 770 /var/lib/analytics
install -d -m 755 /etc/grafana/provisioning/datasources /etc/grafana/provisioning/dashboards/analytics
install -m 644 "$SRC/grafana/datasource.yaml" /etc/grafana/provisioning/datasources/analytics.yaml
install -m 644 "$SRC/grafana/dashboards.yaml" /etc/grafana/provisioning/dashboards/analytics.yaml
install -m 644 "$SRC/grafana/dashboards/"*.json /etc/grafana/provisioning/dashboards/analytics/
GINI=/etc/grafana/grafana.ini
if ! grep -q "^# analytics-setup" "$GINI"; then
  PASS="$(openssl rand -base64 18 | tr -d '/+=')"
  cat >> "$GINI" <<INI
# analytics-setup
[server]
http_addr = 127.0.0.1
domain = ${DOMAIN}
root_url = https://${DOMAIN}/
[security]
admin_password = ${PASS}
[users]
allow_sign_up = false
[analytics]
reporting_enabled = false
check_for_updates = false
check_for_plugin_updates = false
[plugins]
allow_loading_unsigned_plugins = frser-sqlite-datasource
INI
  echo "Grafana: https://${DOMAIN}/ — вход admin / ${PASS} (пароль сохранён в ${GINI})"
fi

# 5. Caddy: журнал запросов у api и сайт аналитики.
CF=/etc/caddy/Caddyfile
install -d -m 755 /etc/caddy/sites
sed "s/stats\.sohimazdai\.ru/${DOMAIN}/" "$HERE/stats.caddy" > /etc/caddy/sites/stats.caddy
chmod 644 /etc/caddy/sites/stats.caddy
cp "$CF" "$CF.bak-analytics"
grep -q "^import /etc/caddy/sites/" "$CF" || printf '\nimport /etc/caddy/sites/*.caddy\n' >> "$CF"
if ! grep -q "/var/log/caddy/access.log" "$CF"; then
  python3 - "$CF" <<'PY'
import re, sys
p = sys.argv[1]; t = open(p).read()
log = "\tlog {\n\t\toutput file /var/log/caddy/access.log {\n\t\t\troll_size 50mb\n\t\t\troll_keep 5\n\t\t}\n\t\tformat json\n\t}\n"
t = re.sub(r"(^api\.sohimazdai\.ru[^\n{]*\{\n)", lambda m: m.group(1) + log, t, count=1, flags=re.M)
open(p, "w").write(t)
PY
fi
if ! caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
  caddy validate --config "$CF" --adapter caddyfile || true
  cp "$CF.bak-analytics" "$CF"
  echo "Caddyfile не прошёл проверку — возвращён прежний" >&2
  exit 1
fi

# caddy validate (от root) сам создаёт файл журнала — отдаём его Caddy, иначе тот не сможет писать.
chown -R caddy:caddy /var/log/caddy
systemctl daemon-reload
systemctl enable --now analytics >/dev/null 2>&1 && systemctl restart analytics
systemctl reload caddy || { journalctl -u caddy -n 25 --no-pager; exit 1; }
systemctl enable --now analytics-agent >/dev/null 2>&1 && systemctl restart analytics-agent
systemctl enable --now grafana-server >/dev/null 2>&1 && systemctl restart grafana-server
[ "${RESTART_RETRO:-}" = 1 ] && systemctl restart retrocine-sync || true
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:8095/a/health >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS http://127.0.0.1:8095/a/health >/dev/null && echo "Аналитика работает. Токен агента для других серверов: ${TOKEN}"
