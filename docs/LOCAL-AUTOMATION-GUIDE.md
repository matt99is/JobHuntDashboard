# Local Database + Automated AI Pipeline Guide

This guide explains how the new setup works in simple terms.

## 1) High-level flow

1. Netlify serves the frontend.
2. Frontend calls your server API.
3. API reads/writes local PostgreSQL.
4. Weekly scheduler runs AI pipeline.
5. Telegram receives run status updates.

## 2) Why this setup

- Keeps frontend deployment simple (Netlify).
- Keeps data private and local (Ubuntu PostgreSQL).
- Keeps job search quality high (AI-driven gathering and research).
- Keeps costs controlled (Haiku-first model policy + score cutoff).

## 3) Score policy

- Any role below **12** is dropped.
- Any role **12 or above** gets researched.

## 4) Weekly schedule

- Monday at 07:00 GMT/UTC.
- Trigger command: `ops/run-pipeline.sh`

## 5) Automation states

A run can end in one of these states:
- `success`: completed normally
- `failed`: hard failure
- `needs_intervention`: AI output invalid/unclear, manual review needed

## 6) Important files

- `database/schema.sql` - local DB schema
- `server/index.js` - API for frontend
- `scripts/run-ai-pipeline.js` - orchestrator
- `scripts/gather-with-claude.js` - intake from email/web
- `scripts/research-with-claude.js` - company research
- `ops/run-pipeline.sh` - scheduler entrypoint

## 7) Telegram notifications

If `SYSTEM_NOTIFY_SCRIPT` is configured, notifications are sent for:
- run started
- run completed
- run failed
- intervention needed

## 8) Gmail intake — how it works

The gather step uses `@anthropic-ai/claude-agent-sdk` (not `claude -p`) so it can inject the Google Workspace MCP server directly into the session. This mirrors the Telegram bot setup at `/opt/claude-bot/app/claude-agent.js`.

The MCP server runs as: `uvx workspace-mcp --single-user --tools gmail`

Credentials are stored in `~/.google_workspace_mcp/credentials/mattlelonek@gmail.com.json` and are picked up automatically in single-user mode.

Required env vars in `.env.local`:
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...   # workspace-mcp credential, not ~/.credentials/
USER_GOOGLE_EMAIL=mattlelonek@gmail.com
```

**Troubleshooting:**

If the gather step fails with `NEEDS_INTERVENTION: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set`, check `.env.local`.

If the gather step completes but `gmail_checked: false`, check `runs/<run-id>/gather-raw-output.txt` and `candidates/gather-raw-output.txt` for Claude's raw output. Common causes:
- workspace-mcp failed to start (check `uvx workspace-mcp --help` works)
- Google OAuth token expired — re-authenticate via the Telegram bot which uses the same credentials
- `~/.google_workspace_mcp/credentials/` is missing or empty

## 9) Safe rollout checklist

1. Start API and confirm `/health` works.
2. Run `npm run db:init`.
3. Run one manual pipeline test: `npm run pipeline:run`.
4. Verify frontend can load and update jobs.
5. Enable weekly cron/systemd schedule.

## 10) Historical data import notes

If you have existing jobs in another system, export and import them before cutover.
Typical approach:
1. Export `jobs` as CSV.
2. Create local schema: `npm run db:init`.
3. Import CSV into local `jobs` table (psql `\\copy` or pgAdmin import).
4. Verify row count and spot-check status/timestamps.
