# Deploying PersonalCRM on GCP (e2-micro + Tailscale)

This guide stands up a free/cheap Google Cloud VM running PersonalCRM in Docker,
with access restricted to your Tailscale network (so it is never exposed on the
public internet). Daily backups go to a Google Cloud Storage bucket.

Rough time estimate: **30–45 minutes** the first time.

---

## 0. Prereqs

- A Google Cloud account with billing enabled (e2-micro is eligible for the
  [GCP always-free tier](https://cloud.google.com/free/docs/free-cloud-features#compute)
  in `us-west1`, `us-central1`, or `us-east1`).
- `gcloud` CLI installed locally ([install](https://cloud.google.com/sdk/docs/install)).
- A [Tailscale](https://tailscale.com) account (free personal plan is enough).
- This repo checked out on your laptop and pushed to GitHub.

---

## 1. Create the project

```bash
export PROJECT_ID="personalcrm-8342"   # or any globally-unique id
export REGION="us-west1"
export ZONE="us-west1-a"

gcloud projects create "$PROJECT_ID" --name="PersonalCRM"
gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# Link billing (replace with your billing account id — find it in GCP console).
gcloud beta billing projects link "$PROJECT_ID" \
  --billing-account=XXXXXX-XXXXXX-XXXXXX

# Enable required APIs.
gcloud services enable compute.googleapis.com storage.googleapis.com
```

---

## 2. Create the backup bucket

```bash
export BUCKET="gs://${PROJECT_ID}-backups"
gsutil mb -l "$REGION" -b on "$BUCKET"
gsutil lifecycle set - "$BUCKET" <<'JSON'
{
  "rule": [
    { "action": {"type": "Delete"}, "condition": {"age": 90} }
  ]
}
JSON
```

---

## 3. Create the e2-micro VM

```bash
gcloud compute instances create personalcrm \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
  --tags=personalcrm \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

> The `cloud-platform` scope lets the VM push backups to GCS without a service
> account key. No firewall rule is needed because access is via Tailscale.

SSH in:

```bash
gcloud compute ssh personalcrm
```

Everything below runs **on the VM**.

---

## 4. Install Docker, Tailscale, sqlite3

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg sqlite3

# Docker (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker   # refresh group membership

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --ssh
# → follow the printed URL on your laptop/phone to authorize this node.
```

Note the VM's Tailscale IP (printed by `tailscale up`) — you'll use it to
reach the app. You can also enable MagicDNS so `personalcrm` just resolves.

---

## 5. Pull and run the app

```bash
sudo mkdir -p /opt/personalcrm
sudo chown "$USER:$USER" /opt/personalcrm
cd /opt/personalcrm

git clone https://github.com/catmeoww/personalcrm.git .
git checkout claude/contact-management-system-c7j84   # or main once merged

mkdir -p data
docker compose up -d --build
docker compose ps
```

The container runs as uid 1000 (the same as your VM user) to match the
ownership of the bind-mounted `./data/` and `~/.claude/` directories. The
SQLite file in `./data/` survives container restarts and image rebuilds.

### Install Claude Code on the VM (powers the import-from-text feature)

The Next.js container shells out to `claude -p` for the freeform-text import.
Auth happens **on the VM**, in the host user's `~/.claude/`, which the
container mounts read/write at `/home/app/.claude`.

```bash
# Install Node 20 + Claude Code CLI on the VM
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g @anthropic-ai/claude-code
claude --version

# One-time auth — opens a device-code prompt. Run interactively:
claude
# Inside the CLI: type /login, follow the URL on your laptop browser,
# paste the code back, then /exit.

# Smoke-test non-interactive mode:
claude -p "Reply with exactly: hello world" --output-format text
```

After auth, restart the app container so it picks up the mounted creds:

```bash
docker compose up -d
```

If the freeform-text import errors with `claude not found` or auth issues,
the import flow falls back to a heuristic extractor (regex for email/phone +
preserving the raw paste as a note), so the feature degrades gracefully.

---

## 6. Access it

From any device on your tailnet:

```
http://<vm-tailscale-ip>:3000
```

Or if MagicDNS is on:

```
http://personalcrm:3000
```

### Optional: HTTPS via Tailscale Serve (recommended for voice)

The Web Speech API often requires a secure context on iOS. Run on the VM:

```bash
sudo tailscale serve --bg 3000
sudo tailscale funnel off   # keep it private
```

You'll get a URL like `https://personalcrm.<your-tailnet>.ts.net` that works
on your phone's Safari and is only reachable from your tailnet.

---

## 7. Install PWA on your phone

On the Tailscale URL above:

- **iOS**: Safari → Share → **Add to Home Screen**.
- **Android**: Chrome → menu → **Install app**.

The PWA installs with the manifest/icon from `public/`.

---

## 8. Daily backup to GCS (cron)

Still on the VM:

```bash
sudo crontab -e
# Add:
15 7 * * *  BUCKET=gs://YOUR_PROJECT_ID-backups \
             DB_PATH=/opt/personalcrm/data/personalcrm.sqlite \
             /opt/personalcrm/scripts/backup.sh >> /var/log/personalcrm-backup.log 2>&1
```

Verify:

```bash
BUCKET=gs://${PROJECT_ID}-backups \
DB_PATH=/opt/personalcrm/data/personalcrm.sqlite \
/opt/personalcrm/scripts/backup.sh
gsutil ls "$BUCKET/"
```

Lifecycle rule (set earlier) deletes backups older than 90 days.

---

## 9. Updating the app

```bash
cd /opt/personalcrm
git pull
docker compose up -d --build
```

SQLite schema is created at boot via `lib/db/init.ts` (idempotent `CREATE TABLE
IF NOT EXISTS`), so updates that only add columns/tables just work. Destructive
migrations: take a manual backup first (step 8).

---

## 10. Restore from a backup

```bash
gsutil cp gs://${PROJECT_ID}-backups/personalcrm-YYYYMMDDTHHMMSSZ.sqlite.gz /tmp/
gunzip /tmp/personalcrm-*.sqlite.gz
docker compose stop app
cp /tmp/personalcrm-*.sqlite /opt/personalcrm/data/personalcrm.sqlite
docker compose start app
```

---

## 11. Costs (estimate)

- **e2-micro VM**: $0 in the always-free regions for one instance/month; ~$7/mo outside.
- **20 GB standard persistent disk**: first 30 GB-months free in the same regions; ~$0.80/mo outside.
- **GCS storage for backups**: cents/month for this data size.
- **Tailscale**: free (personal plan, up to 100 devices).

Total for a single user in a free-tier region: **$0/month**.

---

## 12. Teardown

```bash
gcloud compute instances delete personalcrm --quiet
gsutil -m rm -r "$BUCKET"
gcloud projects delete "$PROJECT_ID"
```

---

## Troubleshooting

- **Container fails to start, `better-sqlite3` error** — rebuild the image on
  the VM (`docker compose build --no-cache`). The native binding compiles
  inside the container, so the host's libc version doesn't matter.
- **500 on first page load, log shows `SQLITE_CANTOPEN`** — the host `./data`
  directory is owned by a uid the container can't write. Fix:
  `sudo chown -R 1000:1000 /opt/personalcrm/data && docker compose restart app`.
- **Freeform-text import says "Claude was unavailable"** — confirm the
  credentials volume mount and CLI on the VM:
  ```bash
  ls -la ~/.claude/.credentials.json
  claude -p "ping" --output-format text
  docker compose exec app claude --version   # must print a version inside the container
  ```
  If `docker compose exec app claude` errors, the image is stale — `docker
  compose build --no-cache` and `docker compose up -d`.
- **Voice button does nothing on iPhone** — you're probably on `http://`. Use
  the `https://…ts.net` Tailscale Serve URL from step 6.
- **Can't reach the VM** — verify both your laptop/phone and the VM show up in
  `tailscale status` on the VM. Run `sudo tailscale up` again if the auth
  expired.
- **"port 3000 already in use"** — `docker compose down` then `up -d`. If
  another service uses 3000, change the `ports:` line in `docker-compose.yml`
  to e.g. `"3080:3000"`.
