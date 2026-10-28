#!/usr/bin/env bash
# Выкладка kinō в прод одной командой: тесты → сервер синхронизации (api.sohimazdai.ru) →
# фронт (sohimazdai.ru/cine/) → проверка, что обе стороны отвечают новой версией.
#
#   ./deploy/deploy.sh                  текущий коммит (HEAD): тесты, сервер, фронт, проверка
#   ./deploy/deploy.sh <ветка|коммит>   другой коммит, например origin/main
#   ./deploy/deploy.sh --api | --web    только сервер или только фронт (можно вместе с коммитом)
#   ./deploy/deploy.sh --no-check       без тестов
#   ./deploy/deploy.sh --status         что сейчас работает
#   ./deploy/deploy.sh --logs [N]       журнал сервера синхронизации
#   ./deploy/deploy.sh --rollback       вернуть предыдущие релизы сервера и фронта
#
# Уходит архив коммита (git archive): незакоммиченные правки не попадают.
# Хосты: CINE_API_HOST (по умолчанию vps@185.209.160.44), CINE_WEB_HOST (vps@45.159.189.71).
# Нужен вход по SSH под vps на оба сервера; пароль спросится не больше раза на сервер
# (чтобы не спрашивал совсем: ssh-copy-id vps@185.209.160.44 и ssh-copy-id vps@45.159.189.71).
set -euo pipefail
API_HOST="${CINE_API_HOST:-vps@185.209.160.44}"
WEB_HOST="${CINE_WEB_HOST:-vps@45.159.189.71}"
SSH_OPTS=(-o ServerAliveInterval=30 -o ControlMaster=auto -o "ControlPath=$HOME/.ssh/kino-%r@%h:%p" -o ControlPersist=120)
api() { ssh "${SSH_OPTS[@]}" "$API_HOST" sudo /usr/local/bin/retrocine-deploy "$@"; }
web() { ssh "${SSH_OPTS[@]}" "$WEB_HOST" sudo /usr/local/bin/cine-deploy "$@"; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

target=all check=1 ref=HEAD
while [ $# -gt 0 ]; do
  case "$1" in
    --status) api --status; echo; web --status; exit ;;
    --logs) api --logs "${2:-100}"; exit ;;
    --rollback) api --rollback; web --rollback; exit ;;
    --api) target=api ;;
    --web) target=web ;;
    --no-check) check=0 ;;
    -h | --help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit ;;
    -*) fail "Неизвестный ключ: $1 (см. --help)" ;;
    *) ref="$1" ;;
  esac
  shift
done

root="$(git rev-parse --show-toplevel)"
cd "$root"
GIT_TERMINAL_PROMPT=0 git fetch --quiet origin 2>/dev/null || true
rev="$(git rev-parse --short "${ref}^{commit}")" || fail "Нет такого коммита: $ref"
say "Выкатываю ${ref} (${rev}): $(git log -1 --format=%s "$rev")"
if [ "$ref" = HEAD ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Внимание: есть незакоммиченные правки — они не попадут в прод."
fi
if ! git branch -r --contains "$rev" 2>/dev/null | grep -q .; then
  echo "Внимание: коммит ещё не отправлен на GitHub (git push), в проде будет то, чего нет в репозитории."
fi
start=$(date +%s)

if [ "$check" = 1 ]; then
  say "Тесты (тот самый коммит, во временной папке)"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  git archive "$rev" | tar -x -C "$tmp"
  if [ -d node_modules ]; then ln -s "$root/node_modules" "$tmp/node_modules"; else (cd "$tmp" && npm ci --silent --no-audit --no-fund); fi
  if [ -d server/node_modules ]; then ln -s "$root/server/node_modules" "$tmp/server/node_modules"; else (cd "$tmp/server" && npm ci --silent --no-audit --no-fund); fi
  (cd "$tmp" && npm run --silent check >"$tmp/check.log" 2>&1) || {
    grep -E "^not ok|^# (pass|fail)" "$tmp/check.log" || tail -30 "$tmp/check.log"
    fail "Тесты не прошли — ничего не выкатываю."
  }
  grep -E "^# (pass|fail)" "$tmp/check.log" | paste -sd' ' -
fi

if [ "$target" != web ]; then
  say "Сервер → ${API_HOST}"
  git archive --format=tar.gz "$rev" server dist | api "$rev"
fi
if [ "$target" != api ]; then
  say "Фронт → ${WEB_HOST}"
  git archive --format=tar.gz "$rev" dist | web "$rev"
fi

say "Проверка"
ok=1
if [ "$target" != web ]; then
  health="$(curl -fsS -m 10 https://api.sohimazdai.ru/health || true)"
  if echo "$health" | grep -q "\"version\":\"$rev\""; then echo "api.sohimazdai.ru: $health"
  else echo "api.sohimazdai.ru отвечает не той версией: ${health:-нет ответа}"; ok=0; fi
fi
if [ "$target" != api ]; then
  front="$(curl -fsS -m 10 https://sohimazdai.ru/cine/RELEASE || true)"
  if [ "$front" = "$rev" ]; then echo "sohimazdai.ru/cine/: $front"
  else echo "sohimazdai.ru/cine/ отдаёт ${front:-ничего} вместо $rev"; ok=0; fi
fi
[ "$ok" = 1 ] || fail "Выкатка прошла, но проверка не сошлась — см. ./deploy/deploy.sh --status"
say "Готово за $(($(date +%s) - start)) с: https://sohimazdai.ru/cine/"
