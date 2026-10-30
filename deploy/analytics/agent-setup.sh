#!/usr/bin/env bash
# Агент аналитики на сервере sohimazdai.ru (planner и статика /cine/): читает журнал Caddy и раз в
# минуту шлёт число запросов по урлам на stats.sohimazdai.ru. Запуск от root: agent-setup.sh <токен>.
# Повторный запуск безопасен. Planner не перезапускается, Caddy только перечитывает конфигурацию.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TOKEN="${1:?нужен токен аналитики (выводит setup.sh на московском сервере)}"
URL="${AGENT_URL:-https://stats.sohimazdai.ru/a/s}"
command -v node >/dev/null || { echo "Нужен Node.js 18+"; exit 1; }
install -d -m 755 /opt/analytics /etc/analytics /var/log/caddy
chown caddy:caddy /var/log/caddy 2>/dev/null || true
rm -rf /opt/analytics/agent && cp -r "$HERE/../../analytics/agent" /opt/analytics/
cat > /etc/analytics/agent.env <<ENV
AGENT_LOG=/var/log/caddy/access.log
AGENT_URL=${URL}
AGENT_TOKEN=${TOKEN}
AGENT_MAP=sohimazdai.ru/cine=retrocine,sohimazdai.ru=planner
ENV
chmod 600 /etc/analytics/agent.env
install -m 644 "$HERE/analytics-agent.service" /etc/systemd/system/analytics-agent.service
# Журнал запросов в блоке сайта sohimazdai.ru (шаблон planner тоже его содержит — после его setup он сохранится).
CF=/etc/caddy/Caddyfile
if ! grep -q "/var/log/caddy/access.log" "$CF"; then
  cp "$CF" "$CF.bak-analytics"
  python3 - "$CF" <<'PY'
import re, sys
p = sys.argv[1]; t = open(p).read()
log = "\tlog {\n\t\toutput file /var/log/caddy/access.log {\n\t\t\troll_size 50mb\n\t\t\troll_keep 5\n\t\t}\n\t\tformat json\n\t}\n"
t, n = re.subn(r"(^sohimazdai\.ru[^\n{]*\{\n)", lambda m: m.group(1) + log, t, count=1, flags=re.M)
if not n: sys.exit("В Caddyfile не найден блок sohimazdai.ru")
open(p, "w").write(t)
PY
  if ! caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then cp "$CF.bak-analytics" "$CF"; echo "Caddyfile не прошёл проверку — возвращён прежний" >&2; exit 1; fi
  systemctl reload caddy
fi
systemctl daemon-reload
systemctl enable --now analytics-agent >/dev/null 2>&1 && systemctl restart analytics-agent
echo "Агент аналитики запущен: $(systemctl is-active analytics-agent)"
