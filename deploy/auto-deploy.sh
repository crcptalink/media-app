#!/usr/bin/env bash
# Pull-based deploy for the church LAN server (192.168.81.99).
# media-app-deploy.timer runs this every 2 minutes as user deploy.
# No SSH inbound: the server fetches the default branch and, only when it moved,
# rebuilds and restarts Docker Compose.
#
#   deploy/auto-deploy.sh           # no-op when HEAD already matches origin
#   deploy/auto-deploy.sh --force   # rebuild even when nothing changed (first run)
set -euo pipefail
set -o errtrace

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_LOG_FILE="${MEDIA_APP_DEPLOY_LOG:-${HOME:-/tmp}/.media-app-deploy.log}"

log() {
  local line
  line="$(printf '%s %s' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*")"
  printf '%s\n' "$line"
  printf '%s\n' "$line" >> "$DEPLOY_LOG_FILE" || true
}

# Run a command, keep its output in the deploy log, and return its status.
run_and_log() {
  set +e
  "$@" 2>&1 | tee -a "$DEPLOY_LOG_FILE"
  local code="${PIPESTATUS[0]}"
  set -e
  return "$code"
}

notify_deploy() {
  local status="$1"
  local sha="$2"
  local short="${sha:0:7}"
  local commit body b64 subject
  commit="$(git log -1 --format=%B "$sha" 2>/dev/null || git log -1 --format=%B 2>/dev/null || true)"
  body="$commit"
  if [[ -n "$sha" ]]; then
    body+=$'\n\n'"${sha}"
  fi
  if [[ "$status" != "ok" ]]; then
    body+=$'\n\n--- last log lines ---\n'
    body+="$(tail -n 40 "$DEPLOY_LOG_FILE" 2>/dev/null || true)"
  fi
  if [[ "$status" == "ok" ]]; then
    subject="CRC Media deployed ${short}"
  else
    subject="CRC Media deploy FAILED ${short}"
  fi
  b64="$(printf '%s' "$body" | base64 -w 0 2>/dev/null || printf '%s' "$body" | base64 | tr -d '\n')"
  # Mail uses the image's node and nodemailer. A missing script or SMTP
  # error must not fail the deploy.
  set +e
  docker compose run --rm --no-deps -T --entrypoint node \
    -e DEPLOY_NOTIFY_STATUS="$status" \
    -e DEPLOY_NOTIFY_SHA="$short" \
    -e DEPLOY_NOTIFY_SUBJECT="$subject" \
    -e DEPLOY_NOTIFY_BODY_B64="$b64" \
    app scripts/notify-deploy.js
  set -e
  return 0
}

on_err() {
  local code=$?
  log "FAILED exit=${code} line=${BASH_LINENO[0]} command=${BASH_COMMAND}"
  if [[ "${DEPLOY_ATTEMPT:-0}" == "1" && "${DEPLOY_NOTIFIED:-0}" != "1" ]]; then
    DEPLOY_NOTIFIED=1
    notify_deploy failed "$(git rev-parse HEAD 2>/dev/null || echo unknown)" || true
  fi
  exit "$code"
}
trap on_err ERR

# Hold the lock on fd 9 for the whole process, including the re-exec below.
# Do not reopen fd 9 later: that drops the lock.
if [[ "${DEPLOY_LOCKED:-}" != "1" ]]; then
  LOCK_FILE="${MEDIA_APP_LOCK_FILE:-${HOME:-/home/deploy}/.media-app-deploy.lock}"
  touch "$LOCK_FILE"
  chmod 600 "$LOCK_FILE" || true
  exec 9>"$LOCK_FILE"
  if ! flock -w 3000 9; then
    log "FAILED could not acquire ${LOCK_FILE} within 50 minutes"
    exit 1
  fi
  export DEPLOY_LOCKED=1
fi

export GIT_TERMINAL_PROMPT=0
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=plain
export COMPOSE_ANSI=never

deploy_stack() {
  local sha="$1"

  # Leave the current app serving. The compile still uses a 1536 MB heap and
  # may use swap on this 3.2 GiB PC, but the site stays up until the image is ready.
  # `up -d` then recreates the container, which is only a short restart.
  # Host .next is not the image, but clear it so nothing stale is left beside the repo.
  # The image build also deletes .next before `next build` (see Dockerfile).
  rm -rf .next
  log "docker compose build (current app keeps serving)"
  run_and_log docker compose build

  log "docker compose up -d --remove-orphans"
  run_and_log docker compose up -d --remove-orphans

  log "waiting for the app container to become healthy"
  local deadline=$((SECONDS + 420)) status="" cid=""
  while (( SECONDS < deadline )); do
    cid="$(docker compose ps -q app || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
      if [[ "$status" == "healthy" ]]; then
        break
      fi
    fi
    sleep 3
  done
  if [[ "$status" != "healthy" ]]; then
    log "FAILED app did not become healthy (status=${status:-unknown}); recent logs follow"
    docker compose logs --tail 120 app db 2>&1 | tee -a "$DEPLOY_LOG_FILE" || true
    return 1
  fi

  # Entrypoint already runs `npx prisma migrate deploy` before the server.
  # Run it again so a migration error fails this deploy instead of only
  # showing up as a restart loop.
  log "applying Prisma migrations (npx prisma migrate deploy)"
  if ! run_and_log docker compose exec -T app npx --no-install prisma migrate deploy; then
    log "FAILED prisma migrate deploy; recent app logs follow"
    docker compose logs --tail 80 app 2>&1 | tee -a "$DEPLOY_LOG_FILE" || true
    return 1
  fi

  # Dangling images only (the previous link-roster:latest). Never prune volumes:
  # that would delete the Postgres data volume.
  log "docker image prune -f"
  docker image prune -f
  log "docker builder prune -f (keep up to 3GB of recent cache)"
  if ! docker builder prune -f --keep-storage 3GB; then
    log "builder prune --keep-storage failed; pruning dangling build cache"
    docker builder prune -f
  fi

  log "deploy ok at ${sha}"
  if [[ "${DEPLOY_NOTIFIED:-0}" != "1" ]]; then
    DEPLOY_NOTIFIED=1
    notify_deploy ok "$sha" || true
  fi
}

# Re-exec after git update so the build runs the script that just landed.
# fd 9 (the lock) is inherited. MEDIA_APP_DEPLOY_PHASE is unset only after we
# have decided to build, so a second entry does the build and returns.
if [[ "${MEDIA_APP_DEPLOY_PHASE:-}" == "apply" ]]; then
  deploy_stack "$(git rev-parse HEAD)"
  exit 0
fi

FORCE=0
case "${1:-}" in
  "") ;;
  --force) FORCE=1 ;;
  *)
    echo "usage: deploy/auto-deploy.sh [--force]" >&2
    exit 2
    ;;
esac

if git symbolic-ref --quiet --short refs/remotes/origin/HEAD >/dev/null 2>&1; then
  branch="$(git symbolic-ref --short refs/remotes/origin/HEAD)"
  branch="${branch#origin/}"
else
  git remote set-head origin --auto >/dev/null
  branch="$(git symbolic-ref --short refs/remotes/origin/HEAD)"
  branch="${branch#origin/}"
fi

git fetch --quiet origin "$branch"

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "origin/${branch}")"

if [[ "$local_sha" == "$remote_sha" && "$FORCE" -eq 0 ]]; then
  exit 0
fi

: > "$DEPLOY_LOG_FILE" || true
export DEPLOY_ATTEMPT=1
if [[ "$local_sha" == "$remote_sha" ]]; then
  log "--force: rebuilding ${remote_sha} with no new commits"
else
  log "updating ${local_sha} -> ${remote_sha}"
fi

git checkout -q -f -B "$branch" "origin/${branch}"
# Ignored files (.env, backups/, node_modules, .next) stay. -e keeps them
# even if a later commit forgets to ignore them.
git clean -fd -e .env -e backups -e 'backups/**'

export MEDIA_APP_DEPLOY_PHASE=apply
exec "$REPO_ROOT/deploy/auto-deploy.sh"
