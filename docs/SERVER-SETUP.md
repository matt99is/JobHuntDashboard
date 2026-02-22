# Server Setup (Ubuntu)

This guide provisions the current architecture:
- local PostgreSQL
- local API
- weekly automated pipeline

For runtime operations and troubleshooting after setup, use `docs/LOCAL-AUTOMATION-GUIDE.md`.

## Step 0: Go to project

```bash
cd /home/matt99is/projects/JobHuntDashboard
```

## Step 1: Install dependencies

```bash
npm install
```

## Step 2: Install PostgreSQL (if needed)

```bash
bash ops/setup/01-install-postgres.sh
```

## Step 3: Create DB + DB user

```bash
DB_PASSWORD='REPLACE_WITH_STRONG_PASSWORD' bash ops/setup/02-create-db-and-user.sh
```

Copy the printed `DATABASE_URL`.

## Step 4: Create `.env.local`

```bash
API_BASE_URL='https://YOUR_API_DOMAIN' \
DATABASE_URL='postgresql://jobhunt:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/jobhunt' \
ADZUNA_APP_ID='...' \
ADZUNA_APP_KEY='...' \
GOOGLE_OAUTH_CLIENT_ID='...' \
GOOGLE_OAUTH_CLIENT_SECRET='...' \
USER_GOOGLE_EMAIL='you@gmail.com' \
GMAIL_JOB_LABEL='Jobs' \
GMAIL_JOB_LOOKBACK_DAYS='7' \
SYSTEM_NOTIFY_SCRIPT='/home/matt99is/projects/IntelligencePortal/scripts/system_notify_enqueue.py' \
bash ops/setup/03-create-env-local.sh
```

Notes:
- Full key list and defaults: `.env.example`
- Gmail OAuth keys are required for full pipeline runs

## Step 5: Initialize database schema

```bash
bash ops/setup/04-init-schema.sh
```

## Step 6: API smoke check

```bash
npm run server
```

In another terminal:

```bash
curl -fsS http://localhost:8788/health
```

Stop API with `Ctrl+C`.

## Step 7: Run setup smoke script

```bash
bash ops/setup/07-smoke-test.sh
```

## Step 8: Run one full manual pipeline

```bash
npm run pipeline:run
```

## Step 9: Install API as user service

```bash
bash ops/setup/08-install-api-service.sh
```

If user services should continue after logout:

```bash
bash ops/setup/05-enable-linger.sh
```

## Step 10: Enable weekly schedule

Choose one option.

### Option A (recommended): systemd timer

```bash
bash ops/setup/05-enable-linger.sh
bash ops/setup/05-install-systemd-timer.sh
systemctl --user list-timers jobhunt-pipeline.timer --all
```

### Option B: cron

```bash
bash ops/setup/06-install-cron.sh
crontab -l
```

## Step 11: Public API domain (optional, for Netlify frontend)

```bash
API_DOMAIN=api.jobs.example.com bash ops/setup/09-configure-nginx-api.sh
API_DOMAIN=api.jobs.example.com EMAIL=you@example.com bash ops/setup/10-enable-api-https.sh
curl -sS https://api.jobs.example.com/health
```

## Step 12: Netlify frontend environment

Set:
- `VITE_API_BASE_URL=https://YOUR_API_DOMAIN`

Redeploy frontend.

## Step 13: Post-setup verification

```bash
systemctl --user status jobhunt-api.service --no-pager
systemctl --user list-timers jobhunt-pipeline.timer --all
npm run pipeline:run
```
