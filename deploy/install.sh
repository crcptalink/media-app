#!/usr/bin/env bash
# One-time setup on the church PC. Safe to run again.
#   cd /home/deploy/media-app
#   sudo bash deploy/install.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/install.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [[ ! -f "$REPO_DIR/docker-compose.yml" || ! -f "$REPO_DIR/.env.example" ]]; then
  echo "This does not look like the CRC Media repo ($REPO_DIR)." >&2
  exit 1
fi

if ! id deploy >/dev/null 2>&1; then
  echo "User 'deploy' does not exist. Create it and clone the repo to /home/deploy/media-app first." >&2
  exit 1
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

install_docker() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    echo "Docker install from Docker's Ubuntu repo expects Ubuntu (found ${ID:-unknown})." >&2
    exit 1
  fi
  local codename="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  log "Docker already installed ($(docker --version)); skipping Docker Engine install."
else
  log "Installing Docker Engine and the Compose plugin from Docker's apt repository."
  install_docker
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is still not available after install." >&2
  exit 1
fi

usermod -aG docker deploy

if ! command -v openssl >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y openssl
fi

set_kv() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  KEY="$key" VALUE="$value" awk '
    BEGIN { key = ENVIRON["KEY"]; value = ENVIRON["VALUE"]; found = 0 }
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

env_get() {
  local key="$1" line value
  line="$(grep -E "^${key}=" "$REPO_DIR/.env" | tail -n 1 || true)"
  value="${line#*=}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

if [[ ! -f "$REPO_DIR/.env" ]]; then
  log "Creating .env from .env.example with generated secrets."
  umask 077
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  pg="$(openssl rand -hex 24)"
  auth="$(openssl rand -base64 32 | tr -d '\n')"
  tv="$(openssl rand -hex 16)"
  kiosk="$(openssl rand -hex 16)"
  set_kv "$REPO_DIR/.env" POSTGRES_PASSWORD "$pg"
  set_kv "$REPO_DIR/.env" DATABASE_URL "postgresql://link:${pg}@localhost:5432/linkroster"
  set_kv "$REPO_DIR/.env" AUTH_SECRET "$auth"
  set_kv "$REPO_DIR/.env" AUTH_URL "https://media-app.crcchurch.com"
  set_kv "$REPO_DIR/.env" APP_URL "https://media-app.crcchurch.com"
  set_kv "$REPO_DIR/.env" TV_TOKEN "$tv"
  set_kv "$REPO_DIR/.env" KIOSK_TOKEN "$kiosk"
  set_kv "$REPO_DIR/.env" SMTP_APP_PASSWORD "REPLACE_WITH_GMAIL_APP_PASSWORD"
  set_kv "$REPO_DIR/.env" SEED_ADMIN_EMAIL "REPLACE_WITH_ADMIN_EMAIL"
  umask 022
else
  log ".env already exists; leaving secrets unchanged."
fi

# Source tree must be writable by deploy (git reset). Leave backups/ alone:
# the backup container writes there as the postgres user.
find "$REPO_DIR" \( -path "$REPO_DIR/backups" -o -path "$REPO_DIR/backups/*" \) -prune -o -exec chown deploy:deploy {} +
chown deploy:deploy "$REPO_DIR/.env"
chmod 600 "$REPO_DIR/.env"

if ! sudo -u deploy git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$REPO_DIR"; then
  sudo -u deploy git config --global --add safe.directory "$REPO_DIR"
fi

deploy_group="$(id -gn deploy)"
sed \
  -e "s|/home/deploy/media-app|${REPO_DIR}|g" \
  -e "s|^Group=deploy|Group=${deploy_group}|" \
  "$REPO_DIR/deploy/systemd/media-app-deploy.service" \
  > /etc/systemd/system/media-app-deploy.service
install -m 0644 "$REPO_DIR/deploy/systemd/media-app-deploy.timer" /etc/systemd/system/media-app-deploy.timer
systemctl daemon-reload
systemctl enable --now media-app-deploy.timer
log "Timer media-app-deploy.timer is enabled."

if ! sudo -u deploy -H id -nG | tr ' ' '\n' | grep -qx docker; then
  echo "User deploy is not in the docker group yet. Open a new login and re-run this script." >&2
  exit 1
fi

log "First deploy (--force)."
sudo -u deploy -H bash -c 'cd "$1" && exec ./deploy/auto-deploy.sh --force' _ "$REPO_DIR"

seed_if_empty() {
  if ! grep -q '"seed"[[:space:]]*:' "$REPO_DIR/package.json"; then
    log "No npm seed script; skipping seed."
    return 0
  fi
  local email count
  email="$(env_get SEED_ADMIN_EMAIL)"
  if [[ "$email" != *"@"* || "$email" == REPLACE* || "$email" == *" "* ]]; then
    log "SEED_ADMIN_EMAIL is still a placeholder; not seeding."
    return 0
  fi
  count="$(sudo -u deploy -H bash -c "cd \"\$1\" && docker compose exec -T db psql -U link -d linkroster -tAc 'SELECT COUNT(*) FROM \"User\"'" _ "$REPO_DIR")"
  count="${count//[[:space:]]/}"
  if [[ "$count" != "0" ]]; then
    log "Database already has ${count} user(s); skipping seed."
    return 0
  fi
  log "Database is empty; seeding the first admin (${email})."
  sudo -u deploy -H bash -c 'cd "$1" && docker compose exec -T app npm run seed' _ "$REPO_DIR"
}

seed_if_empty

smtp="$(env_get SMTP_APP_PASSWORD)"
email="$(env_get SEED_ADMIN_EMAIL)"
need_hand=0
if [[ -z "$smtp" || "$smtp" == REPLACE* ]]; then
  need_hand=1
fi
if [[ -z "$email" || "$email" != *"@"* || "$email" == REPLACE* ]]; then
  need_hand=1
fi

if [[ "$need_hand" -eq 1 ]]; then
  cat <<EOF

Fill these in by hand in ${REPO_DIR}/.env (install will not overwrite them):

  SMTP_APP_PASSWORD   Gmail app password for the crcptalink mailbox
                      (Google Account -> Security -> App passwords).
                      Current value: ${smtp:-<empty>}

  SEED_ADMIN_EMAIL    Email address of the first admin / lead.
                      Current value: ${email:-<empty>}

Optional: SEED_ADMIN_PASSWORD (otherwise the admin signs in with an email link).

Then recreate the app so it sees the new values, and seed if you have not yet:

  cd ${REPO_DIR}
  docker compose up -d
  docker compose exec app npm run seed

EOF
else
  log "SMTP_APP_PASSWORD and SEED_ADMIN_EMAIL are set."
fi

cat <<EOF
Auto-deploy is on. Every 2 minutes the server fetches the default branch and
rebuilds only when it changed. Logs:

  journalctl -u media-app-deploy
  cd ${REPO_DIR} && docker compose ps

Pause:  sudo systemctl disable --now media-app-deploy.timer
Resume: sudo systemctl enable --now media-app-deploy.timer
EOF
