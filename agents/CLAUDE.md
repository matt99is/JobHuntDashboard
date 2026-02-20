# Job Hunt Dashboard - Claude Workflow Instructions

## Purpose
Run a weekly AI-first job search pipeline that:
1. Collects jobs from email + web sources in parallel.
2. Deduplicates and scores roles.
3. Drops anything below score 12.
4. Researches every role with score >= 12.
5. Syncs approved roles to the local dashboard database.

## Quick Commands

| Command | Action |
|---------|--------|
| "run job search" | Full workflow now (manual trigger) |
| "run weekly pipeline" | Run automation flow used by scheduler |
| "sync jobs" | Sync candidate files to local database |

## Source Intake Rules

Use parallel collection where possible.

### Sources
- LinkedIn alert emails (via Gmail search)
- uiuxjobsboard
- WorkInStartups
- Indeed UK (if accessible)
- Adzuna API (script)

### Model policy
- Gather step: Haiku only
- Research step: Haiku by default
- Do not escalate to expensive models automatically

## Scoring + Cutoff

### Hard excludes
- Not Manchester area and not Remote UK
- Contract/freelance/part-time
- Gambling companies
- Older than 14 days
- Lead/Principal/Head-of roles
- Strong UI-only roles

### Scoring (0-25)
- +3: ecommerce, retail, user research, conversion, figma
- +2: b2b, saas, prototyping, design system
- +3: Senior UX
- +2: Mid UX
- +2: Remote
- +3: salary >= 80k
- +2: salary 65k-79k
- +1: salary 50k-64k
- -5: UI/UX-heavy or UI-designer emphasis

### Cutoff
- Score < 12: drop
- Score >= 12: research

## Research Rules

For each score >= 12 role:
1. Verify direct job URL (do not guess).
2. Mark expired if listing is clearly closed.
3. Detect recruiter/intermediary signals.
4. Return evidence-backed red flags only.

### Research output format
```json
{
  "id": "source-company-role",
  "company": "Example Co",
  "is_recruiter": false,
  "direct_job_url": "https://...",
  "expired": false,
  "red_flags": []
}
```

## Local Files

- `candidates/linkedin.json`
- `candidates/uiuxjobsboard.json`
- `candidates/workinstartups.json`
- `candidates/indeed.json`
- `candidates/adzuna.json`
- `candidates/research-queue.json`
- `candidates/research-results.json`

## Pipeline Scripts

1. `scripts/fetch-adzuna.js`
2. `scripts/gather-with-claude.js`
3. `scripts/filter-new.js`
4. `scripts/research-with-claude.js`
5. `scripts/merge-research.js`
6. `scripts/sync-jobs.js`
7. `scripts/run-ai-pipeline.js`

## Final Reporting

At completion, report only newly synced jobs and include:
- Source counts
- Researched count
- Synced count
- Dropped below 12 count
- Any intervention-needed items
