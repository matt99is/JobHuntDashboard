# Job Hunt Dashboard

Job tracking dashboard with:
- Netlify frontend
- Local PostgreSQL database (on your Ubuntu server)
- Local API (`server/index.js`)
- Weekly AI pipeline (Monday 07:00 UTC)

## Current Architecture

1. Frontend calls `VITE_API_BASE_URL`.
2. API reads/writes local PostgreSQL.
3. Weekly scheduler runs `scripts/run-ai-pipeline.js`.
4. Pipeline flow:
   - `fetch-adzuna.js`
   - `gather-with-claude.js` (email + web intake)
   - `filter-new.js` (dedupe + cutoff)
   - `research-with-claude.js`
   - `merge-research.js`
   - `sync-jobs.js`

Score policy:
- `< 12` is dropped
- `>= 12` is researched and eligible for dashboard sync

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

## Core Commands

- `npm run server` - start local API
- `npm run db:init` - apply local DB schema
- `npm run pipeline:run` - run full pipeline now
- `npm run fetch:all` - run deterministic source fetches
- `npm run filter:new` - build research queue
- `npm run merge:research -- --results=candidates/research-results.json`
- `npm run sync` - sync candidates into local DB

## Required Environment Variables

Minimum:
- `VITE_API_BASE_URL`
- `DATABASE_URL` (or `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`)
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Optional:
- `SYSTEM_NOTIFY_SCRIPT`
- `SYSTEM_NOTIFY_PROJECT`
- `CLAUDE_GATHER_ALLOWED_TOOLS` (only if Gmail MCP tool names differ)

## Operations

- Weekly timer/service files: `ops/systemd/`
- Scheduler entrypoint: `ops/run-pipeline.sh`
- Setup scripts: `ops/setup/`

## Docs

- Setup and server provisioning: `docs/SERVER-SETUP.md`
- Automation behavior and failure handling: `docs/LOCAL-AUTOMATION-GUIDE.md`
- Developer-oriented architecture notes: `docs/DEVELOPER-GUIDE.md`

