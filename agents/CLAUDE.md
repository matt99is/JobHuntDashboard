# Job Hunt Dashboard - Claude Workflow Instructions

## Purpose

Run the current pipeline consistently:
1. Collect candidates from Adzuna and Gmail label alerts.
2. Dedupe and filter new roles.
3. Research shortlisted roles (score cutoff based).
4. Sync qualifying jobs to local PostgreSQL.

## Canonical Pipeline Order

1. `scripts/fetch-adzuna.js`
2. `scripts/gather-with-claude.js`
3. `scripts/filter-new.js`
4. `scripts/research-with-claude.js`
5. `scripts/merge-research.js`
6. `scripts/sync-jobs.js`
7. `scripts/run-ai-pipeline.js` (orchestrates 1-6)

## Active Sources

- `adzuna` (deterministic API fetch)
- `gmail` (label-driven intake + web enrichment)

Inactive historical sources (do not use unless re-enabled in code):
- LinkedIn/UIUXJobsBoard/WorkInStartups/Indeed direct gather arrays

## Model and Tooling Policy

- Gather: Claude Agent SDK with Gmail MCP + `WebSearch`/`WebFetch`
- Research: `claude -p` with `WebSearch`/`WebFetch`
- Default model: Haiku unless explicitly overridden by env

## Score and Filtering Policy

- Global cutoff: `JOB_SCORE_CUTOFF` (default `12`)
- `< cutoff`: dropped before sync
- `>= cutoff`: eligible for research and sync
- Salary floor: `JOB_MIN_SALARY` (default `50000`)

## Source/Dedupe Rules

Use the shared dedupe behavior implemented in scripts:
- canonical URL key
- source+company+title key
- company+title key
- content fingerprint key

When duplicates merge, preserve source provenance in `source` as comma-separated tags (e.g. `adzuna,gmail`).

## Required Candidate Files

- `candidates/adzuna.json`
- `candidates/gmail.json`
- `candidates/research-queue.json`
- `candidates/research-results.json`

## Reporting Expectations

At completion, report:
- source counts
- research queue count
- researched count
- synced count
- dropped counts (salary/cutoff/duplicates)
- intervention-needed items
