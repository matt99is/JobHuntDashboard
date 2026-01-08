# Job Hunt Dashboard

UX/Product Designer job tracking with automated search. React + TypeScript + Supabase.

**Live:** [jobs.mattlelonek.co.uk](https://jobs.mattlelonek.co.uk)

## Quick Start

```bash
npm install
npm run dev        # Dashboard at localhost:5173
npm run sync       # Sync jobs to Supabase
```

## Job Search with Claude Code

**All instructions are in [`agents/CLAUDE.md`](agents/CLAUDE.md)**

Just say:
- "run job search" → Full workflow (scrape → research → sync)
- "check my email for jobs" → LinkedIn email scan
- "sync jobs" → Database sync only

## Structure

```
├── agents/CLAUDE.md      # Claude Code instructions (start here)
├── candidates/           # Scraped job JSON files
├── scripts/sync-jobs.js  # Merge + dedupe + Supabase insert
├── src/                  # React dashboard
└── supabase-schema.sql   # Database schema
```

## Search Criteria

- **Location:** Manchester, Remote UK, Overseas with UK remote
- **Type:** Permanent only
- **Exclude:** Gambling, Senior PD, Junior UX <£50k, >30 days old
- **Scoring:** e-commerce +3, b2b/saas +2, Senior UX +3, Remote +2

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind, Vite
- **Backend:** Supabase (PostgreSQL)
- **Hosting:** Netlify
- **Search:** Claude Code with Haiku subagents

## Setup

```bash
cp .env.example .env.local   # Add Supabase credentials
npm install
```
