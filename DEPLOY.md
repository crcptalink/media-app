# Deploying CRC Media on the church PC

The app runs on the Ubuntu PC at **192.168.81.99** (user `deploy`, checkout `/home/deploy/media-app`, port **3000**). Nothing can SSH in from outside the LAN, so the server pulls the default branch itself. Docker Engine is already installed there (the installer leaves it alone when `docker` and `docker compose` are on PATH).

The machine is a Core i3-550 with **3.2 GiB RAM** (~2.6 GiB free) and **3.7 GiB swap**. Compose caps the app at 512m, Postgres at 384m (`shared_buffers=64MB`, `max_connections=20`), and the backup helper at 128m. The image build uses a 1536 MB Node heap and a Next.js standalone runtime so the compile fits.

## One-time setup

On the server, as a user who can `sudo`, after the repo is cloned to `/home/deploy/media-app` with the read-only deploy key:

```bash
cd /home/deploy/media-app
git pull --ff-only origin main
sudo bash deploy/install.sh
```

`deploy/install.sh` is safe to run again. It will:

1. Skip Docker if `docker` and `docker compose` already work. Otherwise install Docker Engine and the Compose plugin from Docker's Ubuntu apt repository.
2. Add `deploy` to the `docker` group.
3. Create `.env` from `.env.example` **only if `.env` is missing**, with random `POSTGRES_PASSWORD`, `DATABASE_URL`, `AUTH_SECRET`, `TV_TOKEN`, and `KIOSK_TOKEN`, and `APP_URL=http://192.168.81.99:3000`.
4. Enable `media-app-deploy.timer` (first run about a minute after boot, then every 2 minutes).
5. Build and start the stack once (`deploy/auto-deploy.sh --force`).
6. Seed the first admin when `package.json` has a `seed` script, `SEED_ADMIN_EMAIL` is a real address, and the `User` table is empty.

## What you must type into `.env`

Install leaves two placeholders. Edit them on the server (do not commit `.env`):

| Variable | What to put |
|---|---|
| `SMTP_APP_PASSWORD` | Gmail app password for `crcptalink@gmail.com` (2-Step Verification, then Google Account → Security → App passwords). The file contains `REPLACE_WITH_GMAIL_APP_PASSWORD` until you replace it. |
| `SEED_ADMIN_EMAIL` | Email address of the first admin / lead. The file contains `REPLACE_WITH_ADMIN_EMAIL` until you replace it. |

Optional: `SEED_ADMIN_PASSWORD` if you want a password as well as the email sign-in link. `SEED_ADMIN_NAME` defaults to the value in `.env.example`.

Generated for you (leave them unless you are rotating secrets): `POSTGRES_PASSWORD`, `DATABASE_URL`, `AUTH_SECRET`, `TV_TOKEN`, `KIOSK_TOKEN`, `APP_URL`.

After editing `.env`, load it and seed:

```bash
cd /home/deploy/media-app
docker compose up -d
docker compose exec app npm run seed
```

`docker compose up -d` recreates the app container when `.env` changed, which is what makes the new SMTP password and admin email visible. Seed is safe to run again. It creates the Link department, positions, service templates, the admin user, the old sheet's notes, and the next 8 weeks of events.

Until `SMTP_APP_PASSWORD` is set, sign-in links and calendar mail are printed in the app log (`docker compose logs app`) instead of being sent.

## How auto-deploy works

`media-app-deploy.timer` starts `media-app-deploy.service` as user `deploy`. The service runs `deploy/auto-deploy.sh`, which:

1. Takes a lock so two runs never overlap.
2. `git fetch`es the default branch quietly.
3. If local `HEAD` already matches the remote, exits 0 and does nothing else.
4. Otherwise fast-forwards (or resets) to `origin`, runs `docker compose build` while the current app keeps serving, then `docker compose up -d --remove-orphans` to swap in the new image.
5. Waits until the app is healthy. The container entrypoint runs `npx prisma migrate deploy` before the server; the script runs that same command again so a bad migration fails the deploy.
6. `docker image prune -f` and `docker builder prune -f` (keeping up to 3 GB of recent build cache). Volumes are not pruned.
7. Emails the result to `DEPLOY_NOTIFY_EMAIL`, or `SEED_ADMIN_EMAIL` if that is empty. Nothing is sent while the SMTP app password or the address is still a placeholder, and a mail failure does not fail the deploy. A check that finds no new commits does not send mail.

A rebuild with no new commit (the first install, or a manual retry):

```bash
cd /home/deploy/media-app
sudo -u deploy -H ./deploy/auto-deploy.sh --force
```

`.env` and `backups/` are gitignored and are not touched by the reset.

## Logs and status

```bash
  sudo journalctl -u media-app-deploy -n 200 --no-pager
cd /home/deploy/media-app && docker compose ps
docker compose logs --tail 80 app
curl -fsS http://127.0.0.1:3000/api/health
```

Unchanged checks are silent on purpose, so the journal is not a line every two minutes. A line appears when a deploy starts, finishes, or fails.

## Pause and resume

```bash
sudo systemctl disable --now media-app-deploy.timer
sudo systemctl enable --now media-app-deploy.timer
```

Pausing stops the pull. Containers that are already up keep running (`restart: unless-stopped`).

## Backups

The `backup` service writes `backups/linkroster-YYYY-MM-DD_HHMM.sql.gz` nightly at 02:00 and keeps 30 days. See the main README for a manual dump and the restore command.
