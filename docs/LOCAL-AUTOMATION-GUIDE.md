# Local Automation Guide

This guide explains how automated runs work once setup is complete.
For installation/provisioning, use `docs/SERVER-SETUP.md`.

## 1) What runs automatically

- Weekly pipeline run: Monday `07:00 UTC`
- Trigger script: `ops/run-pipeline.sh`
- Orchestrator: `scripts/run-ai-pipeline.js`

Optional:
- Daily auto-ghost run: `npm run auto-ghost` (cron/systemd if you enable it)

## 2) Current pipeline behavior

1. Fetch deterministic jobs from Adzuna.
2. Gather Gmail label alerts (`Jobs` by default), then enrich listing data via web tools.
3. Dedupe and filter new jobs.
4. Research shortlist.
5. Merge research results.
6. Sync qualifying jobs to PostgreSQL.

Only two intake sources are active:
- `adzuna`
- `gmail`

## 3) Locking and logs

`ops/run-pipeline.sh` provides:
- lock file: `.locks/pipeline.lock`
- run log: `logs/pipeline-YYYYMMDD-HHMMSS.log`

Pipeline run artifacts:
- `runs/<run-id>/run.json`
- `runs/<run-id>/<step>.log`

## 4) Status model

`run.json` status values:
- `running`
- `success`
- `failed`

Intervention classification:
- If an error contains `NEEDS_INTERVENTION`, notification event type is `pipeline_attention_needed`.
- Otherwise, event type is `pipeline_failed`.

## 5) Notifications

Notifications are optional and script-based:
- `SYSTEM_NOTIFY_SCRIPT`
- `SYSTEM_NOTIFY_PROJECT`

If notification script is missing/unset, pipeline continues and logs `[notify-skip]`.

## 6) Gmail intake details

Gather script: `scripts/gather-with-claude.js`

Behavior:
- Uses workspace-mcp Gmail tools (`uvx workspace-mcp --single-user --tools gmail`)
- Reads label `GMAIL_JOB_LABEL` (default `Jobs`)
- Reads lookback window `GMAIL_JOB_LOOKBACK_DAYS` (default `7`)
- Uses Gmail for discovery and WebSearch/WebFetch for listing enrichment
- Writes normalized output to `candidates/gmail.json`

Required env keys for gather:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `USER_GOOGLE_EMAIL`

## 7) Troubleshooting quick checks

1. Latest run metadata
```bash
ls -1 runs | tail -n 3
cat runs/<run-id>/run.json
```

2. Scheduler logs
```bash
ls -lt logs | head
```

3. Gmail gather diagnostics
```bash
cat candidates/gather-raw-output.txt
cat runs/<run-id>/gather-with-claude.log
```

4. Manual recovery
```bash
npm run pipeline:run
```

## 8) Common failure causes

- Missing OAuth env keys for Gmail gather
- Expired/missing workspace-mcp credentials in `~/.google_workspace_mcp/credentials/`
- Adzuna credentials missing/invalid
- Database connectivity issues (`DATABASE_URL` / `DB_*`)

## 9) Safe rollout checklist

1. Confirm API health: `curl -fsS http://localhost:8788/health`
2. Confirm schema applied: `npm run db:init`
3. Run one full pipeline manually: `npm run pipeline:run`
4. Confirm new rows appear in DB/dashboard
5. Enable weekly timer/cron
