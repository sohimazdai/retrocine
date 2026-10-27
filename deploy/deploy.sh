#!/usr/bin/env bash
# Выкладка kinō: сервер синхронизации → api.sohimazdai.ru, фронт → sohimazdai.ru/cine/.
#   ./deploy/deploy.sh [ref]            — всё сразу (по умолчанию origin/main)
#   ./deploy/deploy.sh --api [ref]      — только сервер
#   ./deploy/deploy.sh --web [ref]      — только фронт
#   ./deploy/deploy.sh --status         — что работает
#   ./deploy/deploy.sh --logs [N]       — журнал сервера синхронизации
#   ./deploy/deploy.sh --rollback       — вернуть предыдущие релизы
# Хосты: CINE_API_HOST (по умолчанию vps@185.209.162.2), CINE_WEB_HOST (vps@45.159.189.71).
# Код уходит архивом коммита (git archive): незакоммиченные правки не попадают.
set -euo pipefail
API_HOST="${CINE_API_HOST:-vps@185.209.162.2}"
WEB_HOST="${CINE_WEB_HOST:-vps@45.159.189.71}"
api(){ ssh -o ServerAliveInterval=30 "$API_HOST" sudo /usr/local/bin/retrocine-deploy "$@"; }
web(){ ssh -o ServerAliveInterval=30 "$WEB_HOST" sudo /usr/local/bin/cine-deploy "$@"; }
case "${1:-}" in
  --status) api --status; echo; web --status; exit;;
  --logs) api --logs "${2:-100}"; exit;;
  --rollback) api --rollback; web --rollback; exit;;
esac
target=all
case "${1:-}" in --api) target=api; shift;; --web) target=web; shift;; esac
cd "$(git rev-parse --show-toplevel)"
REF="${1:-origin/main}"
git fetch --quiet origin 2>/dev/null || true
rev=$(git rev-parse --short "${REF}^{commit}")
start=$(date +%s)
if [ "$target" != web ]; then
  echo "Сервер ← ${REF} (${rev})"
  git archive --format=tar.gz "$rev" server dist/physics.js dist/layout.js dist/world.js dist/state.js | api "$rev"
fi
if [ "$target" != api ]; then
  echo "Фронт ← ${REF} (${rev})"
  git archive --format=tar.gz "$rev" dist | web "$rev"
fi
echo "Готово за $(( $(date +%s) - start )) с: https://sohimazdai.ru/cine/"
