#!/usr/bin/env bash
# Ставит или обновляет аналитику с компьютера разработчика:
#   1) московский сервер: сервис событий, Grafana с дашбордом, агент, подключение retrocine;
#   2) сервер sohimazdai.ru: агент журнала Caddy (RPM planner и /cine/).
# Пакет Grafana и плагин SQLite скачиваются через амстердамский сервер: из России репозиторий
# Grafana закрыт. Нужен sudo на обоих серверах (спросит пароль).
#   ./deploy/analytics/deploy.sh [ref]   (по умолчанию HEAD)
# Хосты: CINE_API_HOST (vps@185.209.160.44), CINE_WEB_HOST (vps@45.159.189.71).
set -euo pipefail
cd "$(dirname "$0")/../.."
REF="${1:-HEAD}"
API_HOST="${CINE_API_HOST:-vps@185.209.160.44}"
WEB_HOST="${CINE_WEB_HOST:-vps@45.159.189.71}"
GV="${GRAFANA_VERSION:-11.6.0}"
PV="${SQLITE_PLUGIN_VERSION:-3.5.0}"
SSH_OPTS=(-o ServerAliveInterval=30 -o ControlMaster=auto -o "ControlPath=$HOME/.ssh/kino-%r@%h:%p" -o ControlPersist=120)
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz -o "$TMP/analytics.tgz" "$REF" analytics deploy/analytics

echo "→ Grafana ${GV} и плагин SQLite ${PV} через ${WEB_HOST}"
ssh "${SSH_OPTS[@]}" "$WEB_HOST" "curl -fsSLo /tmp/grafana.deb https://dl.grafana.com/oss/release/grafana_${GV}_amd64.deb && curl -fsSLo /tmp/frser-sqlite.zip https://github.com/fr-ser/grafana-sqlite-datasource/releases/download/v${PV}/frser-sqlite-datasource-${PV}.zip"
scp -q "${SSH_OPTS[@]}" "$WEB_HOST:/tmp/grafana.deb" "$WEB_HOST:/tmp/frser-sqlite.zip" "$TMP/"

echo "→ ${API_HOST}: сервис, Grafana, агент"
scp -q "${SSH_OPTS[@]}" "$TMP/analytics.tgz" "$TMP/grafana.deb" "$TMP/frser-sqlite.zip" "$API_HOST:/tmp/"
ssh -t "${SSH_OPTS[@]}" "$API_HOST" "rm -rf /tmp/analytics-src && mkdir -p /tmp/analytics-src && tar -xzf /tmp/analytics.tgz -C /tmp/analytics-src && sudo GRAFANA_DEB=/tmp/grafana.deb SQLITE_PLUGIN_ZIP=/tmp/frser-sqlite.zip bash /tmp/analytics-src/deploy/analytics/setup.sh"
TOKEN="$(ssh "${SSH_OPTS[@]}" -t "$API_HOST" "sudo grep '^ANALYTICS_TOKEN=' /etc/analytics/analytics.env" | tr -d '\r' | cut -d= -f2)"

echo "→ ${WEB_HOST}: агент журнала Caddy"
scp -q "${SSH_OPTS[@]}" "$TMP/analytics.tgz" "$WEB_HOST:/tmp/"
ssh -t "${SSH_OPTS[@]}" "$WEB_HOST" "rm -rf /tmp/analytics-src && mkdir -p /tmp/analytics-src && tar -xzf /tmp/analytics.tgz -C /tmp/analytics-src && sudo bash /tmp/analytics-src/deploy/analytics/agent-setup.sh '$TOKEN'"
echo "Готово: https://stats.sohimazdai.ru/ (нужна DNS-запись stats → 185.209.160.44, DNS only)"
