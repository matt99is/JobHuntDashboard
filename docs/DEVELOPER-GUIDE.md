# Developer Guide

This file focuses on code-level ownership and extension points.
For setup and operations, use:
- `README.md`
- `docs/SERVER-SETUP.md`
- `docs/LOCAL-AUTOMATION-GUIDE.md`

## Runtime Components

1. Frontend (`src/`)
   - Calls API via `src/lib/api.ts`
   - No direct database client in browser
2. API (`server/index.js`)
   - CRUD endpoints for jobs
   - Reads/writes PostgreSQL through `lib/db.js`
3. Pipeline (`scripts/`)
   - Weekly orchestration in `scripts/run-ai-pipeline.js`
   - Data intake, scoring, research merge, and DB sync
4. Database (`database/schema.sql`)
   - Single canonical schema file

## Active Pipeline Scripts

- `scripts/fetch-adzuna.js` — deterministic Adzuna API fetch
- `scripts/gather-with-claude.js` — AI intake via Claude Agent SDK + Google Workspace MCP (Gmail) + WebSearch/WebFetch
- `scripts/filter-new.js` — dedupe and build research queue
- `scripts/research-with-claude.js` — company/URL research via `claude -p` (WebSearch/WebFetch only)
- `scripts/merge-research.js` — merge research results into candidate files
- `scripts/sync-jobs.js` — sync approved candidates to PostgreSQL
- `scripts/run-ai-pipeline.js` — weekly orchestrator

Note: `gather-with-claude.js` uses `@anthropic-ai/claude-agent-sdk` directly (not `claude -p`) to inject the Google Workspace MCP server. `research-with-claude.js` still uses `claude -p` as it only needs web tools.

Supporting scripts:
- `scripts/init-db.js`
- `scripts/auto-ghost.js`
- `scripts/check-db-count.js`
- `scripts/reset-db.js`

## Data Files

Generated candidate files:
- `candidates/linkedin.json`
- `candidates/uiuxjobsboard.json`
- `candidates/workinstartups.json`
- `candidates/indeed.json`
- `candidates/adzuna.json`
- `candidates/research-queue.json`
- `candidates/research-results.json`

Run artifacts:
- `runs/<run-id>/run.json`
- `runs/<run-id>/*.log`

## Configuration

Use `.env.local` for local runtime values.
See `.env.example` for the canonical key list.

Important keys:
- `VITE_API_BASE_URL`
- `DATABASE_URL` or `DB_*`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `JOB_SCORE_CUTOFF`
- `GOOGLE_OAUTH_CLIENT_ID` — workspace-mcp Google OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` — workspace-mcp Google OAuth client secret
- `USER_GOOGLE_EMAIL` — Gmail account for job alert intake
- `SYSTEM_NOTIFY_SCRIPT` (optional)

## Extension Points

1. Add a new deterministic source
   - Add `scripts/fetch-<source>.js`
   - Write output into `candidates/<source>.json` using the current job object shape
   - Add source name to `SOURCES` arrays in:
     - `scripts/filter-new.js`
     - `scripts/merge-research.js`
     - `scripts/sync-jobs.js`
   - Add the step in `scripts/run-ai-pipeline.js`

2. Change scoring policy
   - Update scoring logic in source intake scripts
   - Keep cutoff centralized with `JOB_SCORE_CUTOFF`

3. Adjust automation behavior
   - Scheduler entrypoint: `ops/run-pipeline.sh`
   - Systemd units: `ops/systemd/`

## Maintenance Rules

- Keep API access in `src/lib/api.ts` (single frontend data client).
- Keep schema changes in `database/schema.sql` (single DB schema source).
- Prefer updating existing docs over creating duplicate setup docs.
