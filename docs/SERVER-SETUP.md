# Server Setup (Plain Language)

This is the simplest path to finish setup on your Ubuntu server.

## What this gives you

1. Local PostgreSQL database.
2. Local API for your Netlify frontend.
3. Weekly AI pipeline run every Monday at 07:00 GMT.
4. Telegram alerts for start, finish, failure, or intervention needed.

## Step 0: Go to project

```bash
cd /home/matt99is/projects/JobHuntDashboard
```

## Step 1: Install dependencies

```bash
npm install
```

## Step 2: Install PostgreSQL (if not already installed)

```bash
bash ops/setup/01-install-postgres.sh
```

## Step 3: Create DB + DB user

Use your own password:

```bash
DB_PASSWORD='REPLACE_WITH_STRONG_PASSWORD' bash ops/setup/02-create-db-and-user.sh
```

Copy the printed `DATABASE_URL`.

## Step 4: Create `.env.local`

Example:

```bash
API_BASE_URL='https://YOUR_API_DOMAIN' \
DATABASE_URL='postgresql://jobhunt:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/jobhunt' \
ADZUNA_APP_ID='...' \
ADZUNA_APP_KEY='...' \
GOOGLE_OAUTH_CLIENT_ID='...' \
GOOGLE_OAUTH_CLIENT_SECRET='...' \
USER_GOOGLE_EMAIL='you@gmail.com' \
SYSTEM_NOTIFY_SCRIPT='/home/matt99is/projects/IntelligencePortal/scripts/system_notify_enqueue.py' \
bash ops/setup/03-create-env-local.sh
```

The Google OAuth values come from the workspace-mcp credentials stored in `~/.google_workspace_mcp/credentials/`. These are the same credentials the Telegram bot uses. See `docs/LOCAL-AUTOMATION-GUIDE.md` section 8 for details.

## Step 5: Initialize database schema

```bash
bash ops/setup/04-init-schema.sh
```

## Step 6: Start API manually once (test)

```bash
npm run server
```

In another terminal:

```bash
curl -fsS http://localhost:8788/health
```

Stop server with `Ctrl+C`.

## Step 7: Run smoke test

```bash
bash ops/setup/07-smoke-test.sh
```

## Step 8: Run one full manual pipeline test

```bash
npm run pipeline:run
```

## Step 9: Install API as service (recommended)

```bash
bash ops/setup/08-install-api-service.sh
```

If your user services do not persist after logout, also run:

```bash
bash ops/setup/05-enable-linger.sh
```

## Step 10: Enable weekly schedule (pick one)

### Option A (recommended): systemd timer

```bash
bash ops/setup/05-enable-linger.sh
bash ops/setup/05-install-systemd-timer.sh
```

Check schedule:

```bash
systemctl --user list-timers jobhunt-pipeline.timer --all
```

### Option B: cron

```bash
bash ops/setup/06-install-cron.sh
crontab -l
```

## Step 11: Create public API URL (for Netlify)

If your DNS is managed and points to this Ubuntu server, run:

```bash
API_DOMAIN=api.jobs.mattlelonek.co.uk bash ops/setup/09-configure-nginx-api.sh
API_DOMAIN=api.jobs.mattlelonek.co.uk EMAIL=you@example.com bash ops/setup/10-enable-api-https.sh
curl -sS https://api.jobs.mattlelonek.co.uk/health
```

## Step 12: Point Netlify frontend to your local API

In Netlify environment variables, set:

- `VITE_API_BASE_URL=https://YOUR_API_DOMAIN`

Then redeploy frontend.

## Step 13: Import historical data (optional)

1. Export your old `jobs` data as CSV.
2. Import into local PostgreSQL `jobs` table.
3. Verify counts.

## Daily/weekly behavior after setup

- Weekly Monday 07:00 GMT: full AI pipeline run.
- Daily 02:00 GMT (optional cron line): auto-ghost old awaiting applications.

## If a run fails

1. Open latest `runs/<run-id>/run.json`.
2. Read the failed step log in the same folder.
3. Fix issue and rerun:

```bash
npm run pipeline:run
```
