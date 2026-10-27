#!/usr/bin/env bash
# Подготовка чистого Ubuntu 24.04 под api.sohimazdai.ru (синхронизация kinō + LiveKit).
# Запуск от root рядом с остальными файлами этой папки; повторный запуск безопасен.
#   bash setup.sh
#   API_DOMAIN=api.example.ru WEB_ORIGIN=https://example.ru DEPLOY_USER=vps bash setup.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
DOMAIN="${API_DOMAIN:-api.sohimazdai.ru}"
WEB_ORIGIN="${WEB_ORIGIN:-https://sohimazdai.ru}"
DEPLOY_USER="${DEPLOY_USER:-vps}"
SSH_WS_SECRET="${SSH_WS_SECRET:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
step(){ printf '\n== %s\n' "$*"; }

step "Пакеты"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https \
  ufw fail2ban unattended-upgrades python3-websockets jq >/dev/null

step "Сеть: буферы UDP для медиа и быстрый TCP"
cat > /etc/sysctl.d/90-retrocine.conf <<'SYS'
net.core.rmem_max=5000000
net.core.wmem_max=5000000
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.tcp_notsent_lowat=16384
net.ipv4.tcp_slow_start_after_idle=0
SYS
sysctl -q -p /etc/sysctl.d/90-retrocine.conf || true

step "Firewall: SSH, HTTPS, медиа LiveKit (TCP 7881, UDP 7882, TURN 3478 и 30000–30999)"
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw allow 7881/tcp >/dev/null; ufw allow 7882/udp >/dev/null; ufw allow 3478/udp >/dev/null
ufw allow 30000:30999/udp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1

step "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh
  bash /tmp/nodesource.sh >/dev/null && apt-get install -y -qq nodejs >/dev/null
fi
node -v

step "Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

step "LiveKit"
if ! command -v livekit-server >/dev/null; then
  curl -sSL https://get.livekit.io | bash >/dev/null
fi
livekit-server --version

step "Пользователи, каталоги, секреты"
id retrocine >/dev/null 2>&1 || useradd --system --home-dir /opt/retrocine --shell /usr/sbin/nologin retrocine
id livekit >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin livekit
install -d -o root -g root /opt/retrocine /opt/retrocine/releases
install -d -o retrocine -g retrocine -m 750 /var/lib/retrocine /var/lib/retrocine/rooms
install -d -m 755 /etc/retrocine
ENV=/etc/retrocine/retrocine.env
if [ ! -f "$ENV" ]; then
  KEY="API$(openssl rand -hex 6)"; SECRET="$(openssl rand -base64 36 | tr -d '/+=\n')"
  cat > "$ENV" <<ENVF
PORT=8090
DATA_DIR=/var/lib/retrocine/rooms
ALLOWED_ORIGINS=${WEB_ORIGIN},http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000
LIVEKIT_URL=wss://${DOMAIN}
LIVEKIT_API_KEY=${KEY}
LIVEKIT_API_SECRET=${SECRET}
ENVF
fi
chown root:retrocine "$ENV"; chmod 640 "$ENV"
. "$ENV"
sed -e "s/__KEY__/${LIVEKIT_API_KEY}/" -e "s/__SECRET__/${LIVEKIT_API_SECRET}/" -e "s/__DOMAIN__/${DOMAIN}/" \
    -e "s/__IP__/$(curl -4 -fsS https://api.ipify.org || hostname -I | awk '{print $1}')/" \
    "$HERE/livekit.yaml" > /etc/livekit.yaml
chown root:livekit /etc/livekit.yaml; chmod 640 /etc/livekit.yaml

step "Службы"
install -m 755 "$HERE/retrocine-deploy" /usr/local/bin/retrocine-deploy
install -m 644 "$HERE/retrocine-sync.service" "$HERE/livekit.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now livekit >/dev/null 2>&1; systemctl restart livekit
systemctl enable retrocine-sync >/dev/null 2>&1
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/local/bin/retrocine-deploy" > /etc/sudoers.d/retrocine-deploy
  chmod 440 /etc/sudoers.d/retrocine-deploy && visudo -cqf /etc/sudoers.d/retrocine-deploy
fi

step "SSH через WebSocket для Claude (необязательно)"
if [ -n "$SSH_WS_SECRET" ]; then
  install -m 755 "$HERE/ssh-ws-bridge.py" /usr/local/bin/ssh-ws-bridge.py
  install -m 644 "$HERE/ssh-ws.service" /etc/systemd/system/ssh-ws.service
  systemctl daemon-reload && systemctl enable --now ssh-ws >/dev/null 2>&1
  echo "$SSH_WS_SECRET" > /etc/retrocine/ssh-ws-secret; chmod 600 /etc/retrocine/ssh-ws-secret
fi

step "Caddy: https://${DOMAIN}"
SECRET_PATH=""; [ -f /etc/retrocine/ssh-ws-secret ] && SECRET_PATH="$(cat /etc/retrocine/ssh-ws-secret)"
sed -e "s/api\.sohimazdai\.ru/${DOMAIN}/g" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
if [ -n "$SECRET_PATH" ]; then sed -i "s|__SSH_WS_SECRET__|${SECRET_PATH}|" /etc/caddy/Caddyfile
else sed -i '/__SSH_WS_SECRET__/,+2d' /etc/caddy/Caddyfile; fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || { caddy validate --config /etc/caddy/Caddyfile; exit 1; }
systemctl enable caddy >/dev/null 2>&1 && systemctl reload-or-restart caddy

step "Готово. Первый релиз: ./deploy/deploy.sh"
