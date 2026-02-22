# Developer Guide

This document is for code-level ownership and extension.
For setup and operations, use:
- `README.md`
- `docs/SERVER-SETUP.md`
- `docs/LOCAL-AUTOMATION-GUIDE.md`

## Documentation Boundaries (DRY)

- Do not duplicate provisioning steps here.
- Do not duplicate operational runbook steps here.
- Keep environment variable defaults in `.env.example`.
- Update this file when architecture or extension points change.

## Runtime Components

1. Frontend (`src/`)
   - Calls API via `src/lib/api.ts`
2. API (`server/index.js`)
   - CRUD + status transitions
   - Active-job response dedupe
3. Pipeline (`scripts/`)
   - Orchestration in `scripts/run-ai-pipeline.js`
   - Intake, filtering, research, merge, sync
4. Database (`database/schema.sql`)
   - Canonical schema source

## Pipeline Contract (Current)

### Intake sources
- `adzuna` via `scripts/fetch-adzuna.js`
- `gmail` via `scripts/gather-with-claude.js`

### Step order
1. `fetch-adzuna`
2. `gather-with-claude`
3. `filter-new`
4. `research-with-claude`
5. `merge-research`
6. `sync`

### Candidate artifacts
- `candidates/adzuna.json`
- `candidates/gmail.json`
- `candidates/research-queue.json`
- `candidates/research-results.json`
- `candidates/gather-raw-output.txt`

### Run artifacts
- `runs/<run-id>/run.json`
- `runs/<run-id>/*.log`

## Active Pipeline Scripts

- `scripts/fetch-adzuna.js` - deterministic Adzuna fetch + pre-filtering
- `scripts/gather-with-claude.js` - Gmail label intake + web enrichment via Claude SDK + workspace-mcp
- `scripts/filter-new.js` - cross-source dedupe + existing-db exclusion + research queue
- `scripts/research-with-claude.js` - evidence-based company/listing research (`claude -p`)
- `scripts/merge-research.js` - merge research output back into candidate files
- `scripts/sync-jobs.js` - final dedupe + db insertion
- `scripts/run-ai-pipeline.js` - orchestrator + run metadata + notifications

## Dedupe Model (Important)

Dedupe is source-aware and source-agnostic at the same time:
- Canonical URL key
- `source + company + title` key
- `company + title` key
- content fingerprint key

When duplicates are merged, source provenance is preserved as comma-separated tags (e.g. `adzuna,gmail`).

Implemented in:
- `scripts/filter-new.js`
- `scripts/sync-jobs.js`
- `server/index.js` (active jobs response dedupe)

## Configuration

Use `.env.example` as the canonical key list and default values.

Commonly changed keys:
- `JOB_SCORE_CUTOFF`
- `JOB_MAX_AGE_DAYS`
- `JOB_MIN_SALARY`
- `GMAIL_JOB_LABEL`
- `GMAIL_JOB_LOOKBACK_DAYS`
- `DASHBOARD_SCORE_CUTOFF`
- `CLAUDE_GATHER_*`
- `CLAUDE_RESEARCH_*`

## Extension Points

1. Add a new source
   - Add a source script or gather output channel
   - Output to `candidates/<source>.json`
   - Add source to `SOURCES` in:
     - `scripts/filter-new.js`
     - `scripts/merge-research.js`
     - `scripts/sync-jobs.js`
   - Add orchestrator step in `scripts/run-ai-pipeline.js` if needed

2. Change scoring policy
   - Update scoring logic in source intake scripts (`fetch` and `gather`)
   - Keep minimum cutoff behavior aligned with `JOB_SCORE_CUTOFF`

3. Adjust dashboard visibility
   - `DASHBOARD_SCORE_CUTOFF` in `server/index.js`

## Maintenance Rules

- Keep schema changes in `database/schema.sql`.
- Keep frontend API access centralized in `src/lib/api.ts`.
- Keep doc updates in the same PR as behavior changes.
- Update `CHANGELOG.md` for user-visible behavior changes.
