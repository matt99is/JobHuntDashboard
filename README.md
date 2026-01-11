# Job Hunt Dashboard

Personal job tracking dashboard for UX/Product Designer roles. Automates job discovery, tracks applications through the pipeline, and auto-detects ghosting.

**Live:** [jobs.mattlelonek.co.uk](https://jobs.mattlelonek.co.uk)

## Features

- **Automated Job Search** - Scrapes LinkedIn, uiuxjobsboard, WorkInStartups, Indeed
- **Smart Scoring** - Ranks jobs 0-25 based on your criteria
- **Company Research** - Finds red flags (layoffs, Glassdoor ratings, financial issues)
- **Application Tracking** - Pipeline: `new` → `awaiting` → `interview` → `offer/rejected/ghosted`
- **Auto-Ghost Detection** - Marks applications as ghosted after 30 days (via GitHub Actions)
- **Recruiter Detection** - Flags jobs posted by recruitment agencies

## Quick Start

```bash
npm install
cp .env.example .env.local  # Add Supabase credentials
npm run dev                  # Dashboard at localhost:5173
```

## Using with Claude Code

All AI instructions are in [`agents/CLAUDE.md`](agents/CLAUDE.md).

| Say this | What happens |
|----------|--------------|
| "run job search" | Full workflow: scrape → research → sync |
| "sync jobs" | Sync candidates/*.json to database |
| "run auto-ghost" | Mark stale applications as ghosted |

**Models used:** Haiku (scraping, research) + Sonnet (orchestration). No Opus.

## Application Pipeline

```
new → applied → awaiting → interview → offer
                    ↓           ↓
                 ghosted    rejected
```

- **New**: Fresh from job search, not yet applied
- **Awaiting**: Applied, waiting for response
- **Interview**: Got a response, interviewing
- **Offer/Rejected**: Final outcomes
- **Ghosted**: No response after 30 days (auto-set)

## Project Structure

```
├── agents/CLAUDE.md       # AI instructions (start here)
├── candidates/            # Scraped job JSON files
├── scripts/
│   ├── sync-jobs.js       # Merge + dedupe + Supabase upsert
│   ├── auto-ghost.js      # Mark stale jobs as ghosted
│   └── update-research.js # Update single job research
├── src/                   # React dashboard
├── supabase-schema.sql    # Database schema
└── supabase-cron.sql      # Optional: pg_cron auto-ghost
```

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run sync` | Sync candidates to Supabase |
| `npm run auto-ghost` | Ghost stale applications |

## Auto-Ghost Setup (GitHub Actions)

Already configured at `.github/workflows/auto-ghost.yml`. Runs daily at 2 AM UTC.

**To enable:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Push to GitHub - runs automatically

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Supabase (PostgreSQL)
- **Hosting:** Netlify
- **AI Search:** Claude Code with Haiku/Sonnet

## Database Migration

If setting up fresh or updating, run this in Supabase SQL Editor:

```sql
-- See supabase-schema.sql for full schema
-- For existing databases, run the migration comments at the bottom
```

## Search Criteria

- **Location:** Manchester, Remote UK
- **Type:** Permanent only (no contract/freelance)
- **Exclude:** Gambling, Senior PD, Junior UX <£50k, >30 days old
- **Scoring:** e-commerce +3, b2b/saas +2, Senior UX +3, Remote +2
