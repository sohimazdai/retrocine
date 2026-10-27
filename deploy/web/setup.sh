#!/usr/bin/env bash
# Добавляет kinō на существующий сервер sohimazdai.ru (рядом с planner): /cine/ в Caddy и команду выкладки.
# Запуск от root рядом с cine-deploy; повторный запуск безопасен. Planner не затрагивается.
set -euo pipefail
DOMAIN="${WEB_DOMAIN:-sohimazdai.ru}"
DEPLOY_USER="${DEPLOY_USER:-vps}"
HERE="$(cd "$(dirname "$0")" && pwd)"
install -m 755 "$HERE/cine-deploy" /usr/local/bin/cine-deploy
install -d -m 755 /var/www /var/www/cine-releases
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/local/bin/cine-deploy" > /etc/sudoers.d/cine-deploy
  chmod 440 /etc/sudoers.d/cine-deploy && visudo -cqf /etc/sudoers.d/cine-deploy
fi
CF=/etc/caddy/Caddyfile
if ! grep -q "handle_path /cine/\*" "$CF"; then
  BAK="$CF.bak-$(date +%Y%m%d-%H%M%S)"; cp "$CF" "$BAK"
  python3 - "$CF" "$DOMAIN" <<'PY'
import sys, re
p, d = sys.argv[1], sys.argv[2]
t = open(p).read()
m = re.search(r'(?m)^' + re.escape(d) + r'\s*\{[^\n]*\n', t)
if not m: sys.exit(f"В Caddyfile не найден блок {d}")
block = (
    "\t# kinō — 3D-комната ретро (статический фронт, сервер на api." + d + ")\n"
    "\tredir /cine /cine/ 308\n"
    "\thandle_path /cine/* {\n"
    "\t\troot * /var/www/cine\n"
    "\t\theader Cache-Control \"no-cache\"\n"
    "\t\tfile_server\n"
    "\t}\n"
)
t = t[:m.end()] + block + t[m.end():]
open(p, "w").write(t)
PY
  if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy
  else cp "$BAK" "$CF"; echo "Caddyfile не прошёл проверку, вернул как было"; exit 1; fi
fi
echo "Готово: /cine/ подключён, выкладка — ./deploy/deploy.sh"
