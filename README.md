# Job Hunt Dashboard

Job tracking dashboard with:
- Netlify frontend
- Local PostgreSQL database (Ubuntu server)
- Local API (`server/index.js`)
- Automated weekly pipeline (`scripts/run-ai-pipeline.js`)

## Current System (Source of Truth)

1. Frontend calls `VITE_API_BASE_URL`.
2. API reads and writes PostgreSQL.
3. Weekly scheduler runs `ops/run-pipeline.sh`.
4. `ops/run-pipeline.sh` executes `scripts/run-ai-pipeline.js` with lock + logging.
5. Pipeline steps:
   - `fetch-adzuna.js`
   - `gather-with-claude.js` (Gmail label intake + web enrichment)
   - `filter-new.js`
   - `research-with-claude.js`
   - `merge-research.js`
   - `sync-jobs.js`

Active intake sources:
- `adzuna`
- `gmail` (label `Jobs`, last 7 days by default)

Score policy:
- `< 12` is dropped
- `>= 12` is researched and eligible for sync

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run db:init
npm run server
```

In another terminal:

```bash
npm run dev
```

Run the full pipeline manually:

```bash
npm run pipeline:run
```

## Core Commands

- `npm run server` - start local API
- `npm run db:init` - apply local DB schema
- `npm run pipeline:run` - run full pipeline now
- `npm run fetch:all` - deterministic fetches (`adzuna`)
- `npm run filter:new` - build research queue
- `npm run merge:research -- --results=candidates/research-results.json`
- `npm run sync` - sync candidates into local DB
- `npm run auto-ghost` - mark stale awaiting applications as ghosted

## Configuration

Use `.env.example` as the canonical configuration reference.

Required for full pipeline:
- `DATABASE_URL` (or `DB_*` values)
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `USER_GOOGLE_EMAIL`

Common optional overrides:
- `GMAIL_JOB_LABEL` (default `Jobs`)
- `GMAIL_JOB_LOOKBACK_DAYS` (default `7`)
- `JOB_SCORE_CUTOFF` (default `12`)
- `DASHBOARD_SCORE_CUTOFF` (defaults to `JOB_SCORE_CUTOFF`)
- `SYSTEM_NOTIFY_SCRIPT`
- `SYSTEM_NOTIFY_PROJECT`

## Documentation Map (DRY)

- `README.md` (this file): product-level overview and core commands
- `docs/SERVER-SETUP.md`: Ubuntu provisioning + deployment steps
- `docs/LOCAL-AUTOMATION-GUIDE.md`: runtime automation behavior and troubleshooting
- `docs/DEVELOPER-GUIDE.md`: code ownership, architecture, extension points
- `CHANGELOG.md`: versioned change history

Rule: keep details in one place and link to it from other docs.
