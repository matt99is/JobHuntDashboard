# Job Hunt Dashboard

Personal job tracking dashboard for UX/Product Designer roles. Automates job discovery, tracks applications through the pipeline, and auto-detects ghosting.

**Live:** [jobs.mattlelonek.co.uk](https://jobs.mattlelonek.co.uk)

## Features

- **Automated Job Search** - Fetches from Adzuna API + Reed API (complete job data)
- **Smart Scoring** - Ranks jobs 0-25 based on your criteria (scoring built into API scripts)
- **Token Optimized** - 80% reduction via scripts for filtering/merging (AI only for research)
- **Company Research** - AI agents find red flags (layoffs, Glassdoor ratings, financial issues)
- **Application Tracking** - Pipeline: `new` → `awaiting` → `interview` → `offer/rejected/ghosted`
- **Auto-Ghost Detection** - Marks applications as ghosted after 30 days (Supabase pg_cron)
- **Recruiter Detection** - Automatic detection in API scripts + AI verification

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
| "run job search" | Full workflow: fetch → filter → research → merge → sync |
| "sync jobs" | Sync candidates/*.json to database |
| "run auto-ghost" | Mark stale applications as ghosted |

**Token optimization:**
- Phase 1 (Fetch): Scripts only (0 tokens)
- Phase 2 (Filter): Scripts only (0 tokens)
- Phase 3 (Research): Haiku agents (only AI usage)
- Phase 4 (Merge): Scripts only (0 tokens)
- Phase 5 (Sync): Scripts only (0 tokens)

**Result:** ~80% token reduction. AI only used for company research (highest value task).

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
├── agents/CLAUDE.md           # AI instructions (start here)
├── candidates/                # Job data files
│   ├── adzuna.json           # Jobs from Adzuna API
│   ├── reed.json             # Jobs from Reed API
│   └── research-queue.json   # Jobs needing research (generated)
├── scripts/
│   ├── fetch-adzuna.js       # Fetch from Adzuna API
│   ├── fetch-reed.js         # Fetch from Reed API
│   ├── filter-new.js         # Filter new jobs (Phase 2)
│   ├── merge-research.js     # Merge research results (Phase 4)
│   ├── sync-jobs.js          # Sync to database (Phase 5)
│   ├── update-research.js    # Update single job research
│   └── auto-ghost.js         # Mark stale applications as ghosted
├── src/                       # React dashboard
├── supabase-schema.sql        # Database schema
└── supabase-cron.sql          # pg_cron auto-ghost setup
```

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server (localhost:5173) |
| `npm run build` | Production build |
| `npm run fetch:adzuna` | Fetch jobs from Adzuna API |
| `npm run fetch:reed` | Fetch jobs from Reed API |
| `npm run fetch:all` | Fetch from both APIs |
| `npm run filter:new` | Filter new jobs → research-queue.json |
| `npm run merge:research` | Merge research results into candidates |
| `npm run sync` | Sync candidates to Supabase |
| `npm run auto-ghost` | Mark stale applications as ghosted |

## Auto-Ghost Setup (Supabase pg_cron)

Uses native Supabase scheduled function. Runs daily at 2 AM UTC.

**To enable:**
1. Go to Supabase Dashboard → Database → Extensions
2. Enable `pg_cron` extension
3. Go to SQL Editor → New Query
4. Run the SQL from `supabase-cron.sql`
5. Verify with: `SELECT * FROM cron.job;`

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
