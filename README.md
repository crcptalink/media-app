# CRC Media

Volunteer scheduling for the **CRC Pretoria Link department**: volunteers sign in on the church LAN, say Yes/No to slots, claim open slots (the lead approves), mark when they're unavailable, get calendar invites from `crcptalink@gmail.com`, and check in at the door. A large-type TV dashboard shows who is serving and who has arrived.

Stack: Next.js 15 (App Router, TypeScript) · React 19 · Tailwind · PostgreSQL 16 · Prisma 6 · Auth.js v5 (email magic link + optional password) · Nodemailer (Gmail SMTP) · Docker Compose.

The running app is this Next.js project (CRC Media). The Link department keeps its existing pages. `media_app_schema.sql` was already in the repo before this app was imported. It is an earlier PostgreSQL draft for a wider media team (cameras, directors, graphics, comms). CRC Media does not load that file. Schema changes for this app go through Prisma (`prisma/schema.prisma` and `prisma/migrations`).

## Auto-deploy on the church PC

The Ubuntu server at `192.168.81.99` (user `deploy`, repo `/home/deploy/media-app`) pulls the default branch every two minutes and redeploys itself with Docker Compose. Nobody pushes to the server. Docker is already installed there; the installer skips that step when it is.

One-time setup, on the server:

```bash
cd /home/deploy/media-app
sudo bash deploy/install.sh
```

Then fill `SMTP_APP_PASSWORD` and `SEED_ADMIN_EMAIL` in `.env`. Full steps, logs, seeding, and how to pause the timer: [DEPLOY.md](DEPLOY.md).

```bash
sudo journalctl -u media-app-deploy
docker compose ps
sudo systemctl disable --now media-app-deploy.timer
```

The PC is a Core i3-550 with 3.2 GiB of RAM. Compose limits the app to 512m, Postgres to 384m, and backups to 128m. Auto-deploy builds the new image while the current app keeps serving, then `docker compose up -d` swaps it in. The Next.js compile heap is capped at 1536 MB.

---

## Day 1 setup on the church PC (manual)

The timer above is how this checkout is deployed (`deploy` at `/home/deploy/media-app`). The steps below are the hands-on path (user `crclink`, copy a tarball into `~/link-roster`) if you are not using auto-deploy.

1. **Check Ubuntu**: `lsb_release -a` (22.04 or 24.04 are fine), then `sudo apt update && sudo apt upgrade -y`.
2. **Install Docker** (official repo):
   ```bash
   sudo apt install -y ca-certificates curl
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
   sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   sudo usermod -aG docker crclink   # then log out and back in
   docker run hello-world
   ```
3. **Fix the IP**: `ip -4 addr` to see the MAC/IP, then add a DHCP reservation for **192.168.81.99** on the router (or a static IP with netplan).
4. **Gmail app password**: on crcptalink@gmail.com turn on 2-Step Verification, then create an App password (Google Account → Security → App passwords). Keep it for `.env`.
5. **Copy the app** to `~/link-roster`:
   ```bash
   scp link-roster.tar.gz crclink@192.168.81.99:~      # from your laptop
   mkdir -p ~/link-roster && tar xzf ~/link-roster.tar.gz -C ~/link-roster && cd ~/link-roster
   ```
6. **Fill in `.env`**:
   ```bash
   cp .env.example .env
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
   sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" .env
   sed -i "s/^TV_TOKEN=.*/TV_TOKEN=$(openssl rand -hex 16)/; s/^KIOSK_TOKEN=.*/KIOSK_TOKEN=$(openssl rand -hex 16)/" .env
   nano .env    # set SMTP_APP_PASSWORD and SEED_ADMIN_EMAIL (your email)
   ```
   `DATABASE_URL` in `.env` is only for running outside Docker; Compose builds its own from `POSTGRES_PASSWORD`.
7. **Start**: build, then start. If the app is already up, leave it running during the build so the site stays available:
   ```bash
   docker compose build
   docker compose up -d
   curl -fsS localhost:3000/api/health    # {"ok":true,...}
   ```
   Migrations run automatically on every start (`npx prisma migrate deploy` in `docker/entrypoint.sh`).
8. **Seed**: `docker compose exec app npm run seed` — creates the Link department, positions (SL, LS, L, LS + Link 10:30), service templates (Sun 08:30 / 10:30 / 18:00, Thu Training 19:00), the admin/lead user from `SEED_ADMIN_EMAIL`, the old sheet's Notes lines (as plain notes), the 5-minute late grace, and the next 8 weeks of events. Safe to run again.
9. **Sign in**: on a phone on church Wi-Fi open `http://192.168.81.99:3000` and use the email link. Optionally set a password under *My slots → Profile & password*.
10. **Add volunteers**: *People* → add name + email (tick "email them a welcome note"), then open each person to set their training stage per position.
11. **Test an invite**: on *Admin*, pick yourself in a slot and press **Ask**, then answer **Yes** on *My slots*. Check the Accept button in Gmail / Apple Calendar / Outlook. Then change the event's time on its *Details* page (update) and remove yourself (cancellation).
12. **Test check-in + TV**: *Details* → print the door QR code and scan it; open the kiosk link from *Setup* on the door tablet; open the TV link from *Setup* on the TV browser in full screen (F11).
13. **Backups**: the `backup` service writes `./backups/linkroster-YYYY-MM-DD_HHMM.sql.gz` every night at 02:00 and keeps 30 days. Take one now and check it:
    ```bash
    docker compose exec backup sh -c 'pg_dump --no-owner | gzip > /backups/linkroster-manual-$(date +%F).sql.gz'
    ls -lh backups/
    ```
    Restore: `gunzip -c backups/FILE.sql.gz | docker compose exec -T db psql -U link linkroster` (into an empty database).
14. **Smoke test** any time: `scripts/smoke.sh http://localhost:3000` (add `SMOKE_EMAIL=… SMOKE_PASSWORD=…` to also test signed-in pages).

Updating later: with auto-deploy, pushing to the default branch is enough (see [DEPLOY.md](DEPLOY.md)). By hand, keep `.env` and `backups/`, then `docker compose build && docker compose up -d`.

---

## How it works

### Slot flow
| Status | Meaning | Next |
|---|---|---|
| `PROPOSED` | Leader or 2IC pressed **Ask** | Member **Yes** → `ACCEPTED`, **No** → `DECLINED` |
| `CLAIM_PENDING` | Member pressed **Claim** | Leader or 2IC **Approve** → `ACCEPTED`, **Reject** → `REJECTED` |
| `ACCEPTED` | Confirmed, invite sent | Time change → updated invite. Removal → `CANCELLED` + cancellation |
| `DECLINED` / `REJECTED` / `CANCELLED` | Final, slot open again | — |

**Assign** (leader or 2IC) confirms immediately. Every change writes an in-app notice and queues an email. A partial unique index allows only one live (proposed / pending / accepted) person per slot and kind, so two people can never hold the same slot.

### Roles

Department role is stored on each membership. **Member** is the `VOLUNTEER` value. Existing leads were renamed to **Leader**. **Service Leader** is a Link position, not this role.

| | Admin | Leader | 2IC | Member |
|---|---|---|---|---|
| Who | App role Admin | Department role Leader | Department role 2IC | Department role Member |
| Open departments | All | Ticked departments | Ticked departments | Ticked departments |
| Own schedule, yes/no, availability, claim | Yes | Yes | Yes | Yes |
| Department schedule, approve claims, rules, event details | Yes | Their department | Their department | No |
| People and department permissions | Yes | Their department | No | No |
| Setup (templates, grace, screens, generate) and the email outbox | Yes | No | No | No |

An Admin can do every row even without a department tick. A 2IC matches a Leader on the schedule and cannot open People or Setup.

### Training
Positions: **SL** Service Leader, **LS** Livestream, **L** Link, **LSL** LS + Link (10:30, covers LS and L). Each person has a stage per position: **Shadow** (watches the leader set up, usually once) → **Trainee** (sets up while the trainer watches, until ready) → **Qualified**, plus a **Trainer** flag (LST = livestream trainer, LT = link trainer). Every slot has a serving person plus an optional **trainee / shadow** spot, so a trainee is paired with the trainer in that slot. The roster warns when a trainee has no trainer next to them, or when someone who isn't qualified is put in the serving spot.

**Thursday Training**: everyone can answer Yes/No on *My slots*. People who are scheduled in a Thursday slot are shown as *Required*; everyone else is *Optional*, and a leader or 2IC sees all replies on the event's *Details* page.

### Calendar invites
`.ics` with `METHOD:REQUEST`, `UID:asg-<id>@crcptalink`, `SEQUENCE:0`, TZID Africa/Johannesburg, starting at the **arrival** time, organizer crcptalink@gmail.com, the volunteer as `ATTENDEE;RSVP=TRUE`, and a reminder 2 hours before. Updates reuse the UID with `SEQUENCE+1`; cancellations send `METHOD:CANCEL` + `STATUS:CANCELLED` with a higher SEQUENCE. Sent through Nodemailer's `icalEvent` (a `text/calendar; method=…` part) plus an `invite.ics` attachment. All mail goes through the `EmailOutbox` table; a worker in the app sends every 30 s and retries failures with backoff (5 tries). *Emails* (admin) shows failed sends with a Retry button. Without SMTP settings, mail (including sign-in links) is printed to the app log: `docker compose logs app`.

### Check-in
* **QR at the door**: each event has its own QR (on *Details*) → `/checkin?e=…&t=…`; the signed-in volunteer taps "I'm here".
* **Kiosk**: `/kiosk?token=KIOSK_TOKEN` lists today's confirmed names; tap, then confirm.
* **Manual**: a leader or 2IC marks someone in (optionally with a time) or clears it on *Details*; logged in `AuditLog`.

QR / kiosk check-in is open from 60 min before the arrival time until the event ends. Status is computed: **on time** if checked in by arrival + grace (5 min, change on *Setup*), **late** after that, **absent** if nobody checked in by the start.

### TV
`/tv?token=TV_TOKEN` — dark, large type, today's services (or the next day with services), each position with who's serving and Not yet / On time / Late / Absent. Refreshes every 20 s, highlights the next service.

### Rules & Notes
One line per item. Adding or editing a line that looks like a known pattern ("Katlego only 08:30", "Prince and Daniel-son not the same service", "Armand and Carolien always together", "… week on / week off", "… no 10:30") pre-fills a structured rule for you to confirm; otherwise it stays a note. Rule types: only at services, never at services, not in the same service, always together, week on / week off (even/odd ISO weeks, soft), needs supervision. Rules only *warn* on the admin roster — nothing is blocked. Built-in warnings: unavailable, double-booked, training stage/pairing, needs-supervision skill flag.

### Routes
| Screen | Route | Who |
|---|---|---|
| Sign in | `/login` | all |
| My slots, Thursday RSVPs, notices | `/me` | everyone |
| Profile & password | `/me/password` | everyone |
| Roster (read-only + Claim) | `/roster` | everyone |
| Availability | `/me/availability` | everyone |
| Admin roster (Ask/Assign, approve, warnings) | `/admin/roster` | lead |
| Event details (times, slots, check-in, QR, RSVPs) | `/admin/events/[id]` | lead |
| People & skills | `/admin/people` | lead |
| Rules & Notes | `/admin/rules` | lead |
| Setup (templates, positions, grace, generate, screen links) | `/admin/setup` | admin |
| Emails (outbox) | `/admin/outbox` | admin |
| Check-in (QR) | `/checkin?e=…&t=…` | volunteer phone |
| Kiosk | `/kiosk?token=…` | door tablet |
| TV | `/tv?token=…` | TV |
| API | `/api/auth/*`, `POST /api/checkin`, `GET /api/tv`, `GET /api/ics/[assignmentId]`, `GET /api/health` | |

Sign-in is limited to people the lead has added (and who are active). Events for the next 8 weeks are created automatically every 6 hours from the active templates (`GENERATE_WEEKS`), or on demand on *Setup*.

---

## Development

```bash
npm install                      # runs prisma generate
cp .env.example .env             # point DATABASE_URL at a local Postgres
npx prisma migrate deploy && npm run seed
npm run dev                      # http://localhost:3000
npm run typecheck && npm run lint && npm run build
npm test                         # unit tests (ics, rules, check-in)
TEST_DATABASE_URL=postgresql://link:pw@localhost:5432/linkroster_test npm test   # + slot workflow tests on a throwaway DB (migrated)
```

Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name what-changed`.

## Not yet (see the spec's "Later")
Access from outside the LAN (Cloudflare Tunnel / Tailscale), Google/Apple sign-in, Camera and other departments' UI (the data model already supports them), auto-suggest/fairness, day-before reminders, swaps, WhatsApp, push, Wi-Fi/Bluetooth automatic check-in.
